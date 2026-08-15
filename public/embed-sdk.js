/**
 * Embedded Integration SDK — include this script in any page embedded via a
 * `signed_launch` Embedded Integration (a Dashboard Embed widget, or a
 * Custom menu's "Embed a Webpage" mode, on web OR the Android app's
 * WebView) to receive the current platform user's identity via SSO instead
 * of requiring a separate login.
 *
 * See docs/dashboard-system-plan.md section 8.2 ("Embed SDK handshake") for
 * the full protocol design. This file is the CHILD (embedded-page) side of
 * the handshake; the PARENT (host) side lives in
 * features/dashboard/widgets/embed/useSsoHandshake.ts (Dashboard widget) and
 * features/menus/runtime/CustomMenuRuntime.tsx (Custom menu embed).
 *
 * Works in two complementary modes, and this SDK handles both without the
 * embedded page needing to know which one is in play:
 *
 *   Mode A — URL fragment (`#sso_token=<jwt>`), read on page load. This is
 *   the ONLY mode available when there's no `window.parent` to talk to —
 *   e.g. the Android app's WebView, or the page opened directly in a new
 *   tab. This SDK reads it automatically; no call needed.
 *
 *   Mode B — postMessage handshake, for refreshing the token before it
 *   expires without a full page reload. Only usable when actually framed by
 *   a same-session host (window.self !== window.top) — a no-op everywhere
 *   else, including the Android WebView, so calling requestToken() there is
 *   always safe (it just does nothing).
 *
 * Usage in an embedded page:
 *
 *   <script src="https://your-platform.example.com/embed-sdk.js"></script>
 *   <script>
 *     var identity = WorkflowEmbed.getIdentity();
 *     if (identity) {
 *       // { sub, email, name, roles, aud, iat, exp } -- decoded from the JWT
 *       // payload client-side, NOT signature-verified here. Treat this as
 *       // "who the platform says this is" for UI purposes only. If this
 *       // page has its own backend and needs to trust the identity for
 *       // anything privileged (a write, a privileged read), that backend
 *       // MUST independently verify the raw JWT's HS256 signature using
 *       // the integration's shared secret before trusting it -- this SDK
 *       // has no way to do that itself (it doesn't hold the secret).
 *     }
 *
 *     WorkflowEmbed.onToken(function (token, claims) {
 *       // Fires once immediately if a token was already available (mode A
 *       // fragment, or synchronously cached), and again on every refresh
 *       // (mode B handshake reply). Prefer this over getIdentity() if you
 *       // need to react to a token arriving/changing after page load.
 *     });
 *     WorkflowEmbed.onLogout(function () {
 *       // Tear down whatever session onToken established. Only ever fires
 *       // in mode B (the host broadcasts this on platform logout) -- a
 *       // fragment-only session (mode A, e.g. Android) has no live
 *       // connection to the host to receive this over, so plan for tokens
 *       // to simply expire (see onExpiring) rather than relying on it.
 *     });
 *     WorkflowEmbed.onExpiring(function () {
 *       // Fires ~30s before the current token's `exp`. Default behavior
 *       // (if you don't call preventDefault-style suppression -- there
 *       // isn't one; this is purely informational) is to do nothing further
 *       // automatically in mode A. In mode B, the SDK also proactively
 *       // calls requestToken() itself at this point, so onToken will fire
 *       // again shortly after with a fresh token -- this callback is
 *       // primarily useful for mode A embeds (e.g. Android) that have no
 *       // refresh path and need to show "please reopen this page" UI.
 *     });
 *     WorkflowEmbed.requestToken(); // mode B only; no-op elsewhere
 *   </script>
 *
 * Security model: every postMessage this SDK sends or accepts is checked
 * against the parent's actual origin (only ever trusting the FIRST origin a
 * `wf:sso:token`/`wf:sso:logout` message arrives from -- see
 * acceptedParentOrigin below). This SDK never uses `postMessage(..., '*')`
 * to send the token onward or accepts a token relayed by anything other
 * than the direct parent window. The corresponding server-side check (is
 * THIS embedded page's origin in the integration's allowed_origins?)
 * happens on the host side, not here -- this SDK has no way to enforce that
 * policy itself, since it doesn't hold the integration's configuration.
 *
 * The fragment-mode token (mode A) carries no such origin check by its
 * nature -- whoever has the URL has the token, same as any bearer-token
 * link (a Metabase-style signed-embed link). That's why fragments (never
 * sent to any server, never logged, never in Referer) rather than query
 * params are used to carry it, and why token TTLs default short (5 min).
 */
(function (window) {
  'use strict';

  if (window.WorkflowEmbed) return; // idempotent if the script is included twice

  var tokenHandlers = [];
  var logoutHandlers = [];
  var expiringHandlers = [];
  var acceptedParentOrigin = null; // pinned to the first legitimate reply's origin
  var currentToken = null; // raw JWT string, most recently delivered (either mode)
  var currentClaims = null; // decoded payload of currentToken, or null
  var expiryTimer = null;
  var EXPIRING_LEAD_MS = 30 * 1000; // fire onExpiring 30s before exp

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // a cross-origin access error itself implies framing
    }
  }

  /** Base64url decode (JWT's alphabet: '-'/'_' instead of '+'/'/', no
   *  padding) -- atob() alone chokes on both of those, so this normalizes
   *  first. Returns null on any malformed input rather than throwing, since
   *  a corrupt/foreign fragment value should degrade to "no identity", not
   *  break the embedded page's script execution. */
  function base64UrlDecode(str) {
    try {
      var normalized = str.replace(/-/g, '+').replace(/_/g, '/');
      var pad = normalized.length % 4;
      if (pad === 2) normalized += '==';
      else if (pad === 3) normalized += '=';
      else if (pad !== 0) return null;
      var decoded = window.atob(normalized);
      // atob gives a binary string; re-encode as UTF-8 text since claims
      // (name, email) may contain non-ASCII characters.
      var bytes = new Uint8Array(decoded.length);
      for (var i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      return null;
    }
  }

  /** Decodes a JWT's payload segment WITHOUT verifying its signature -- see
   *  this file's top-level doc comment on why that's the intended trust
   *  model here. Returns null for anything that isn't a well-formed
   *  3-segment JWT with a JSON object payload. */
  function decodeJwtPayload(token) {
    if (typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var json = base64UrlDecode(parts[1]);
    if (json === null) return null;
    try {
      var parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function clearExpiryTimer() {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  /** Schedules onExpiring (and, in mode B, a proactive requestToken()) for
   *  ~30s before claims.exp. exp is a Unix seconds timestamp per JWT spec
   *  (RegisteredClaims.ExpiresAt on the Go side) -- multiplied by 1000 for
   *  JS's millisecond Date epoch. If exp is already past (or within the
   *  lead window), fires immediately rather than scheduling a negative or
   *  zero timeout, which setTimeout would otherwise fire on next tick
   *  anyway -- doing it explicitly makes the "already expired" case a
   *  deliberate branch instead of an accidental one. */
  function scheduleExpiry(claims) {
    clearExpiryTimer();
    if (!claims || typeof claims.exp !== 'number') return;
    var msUntilExpiring = claims.exp * 1000 - EXPIRING_LEAD_MS - Date.now();
    var fire = function () {
      for (var i = 0; i < expiringHandlers.length; i++) expiringHandlers[i]();
      if (isInIframe()) WorkflowEmbed.requestToken();
    };
    if (msUntilExpiring <= 0) {
      window.setTimeout(fire, 0);
    } else {
      expiryTimer = window.setTimeout(fire, msUntilExpiring);
    }
  }

  function deliverToken(token) {
    var claims = decodeJwtPayload(token);
    if (claims === null) return; // malformed -- never surface a token we can't parse
    currentToken = token;
    currentClaims = claims;
    scheduleExpiry(claims);
    for (var i = 0; i < tokenHandlers.length; i++) tokenHandlers[i](token, claims);
  }

  /** Reads `sso_token` out of location.hash without disturbing any other
   *  fragment content a page might already be using (e.g. a client-side
   *  router's own `#/path`) -- parsed as a query string after the leading
   *  '#', same shape the fragment is actually built in (see
   *  percentEncode/buildLaunchUrl on the mobile side and embedUrlWithToken
   *  on web, both of which write exactly `#sso_token=<jwt>` with no other
   *  keys today, but this is written to tolerate additional `&key=value`
   *  pairs appearing later without a breaking change here). */
  function readFragmentToken() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return null;
    var params;
    try {
      params = new URLSearchParams(hash.slice(1));
    } catch (e) {
      return null;
    }
    return params.get('sso_token');
  }

  function onMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    var type = event.data.type;
    if (type !== 'wf:sso:token' && type !== 'wf:sso:logout') return;

    // Pin to the first origin that ever sends us a real SSO message, then
    // require every subsequent message match it -- this SDK has no
    // allowlist of its own (only the host's own allowed_origins check knows
    // that), so "same origin as last time" is the only self-defense
    // available here against a *different* frame injecting messages.
    if (acceptedParentOrigin === null) {
      acceptedParentOrigin = event.origin;
    } else if (event.origin !== acceptedParentOrigin) {
      return;
    }

    if (type === 'wf:sso:token') {
      var token = event.data.token;
      if (typeof token !== 'string' || !token) return;
      deliverToken(token);
    } else if (type === 'wf:sso:logout') {
      currentToken = null;
      currentClaims = null;
      clearExpiryTimer();
      for (var j = 0; j < logoutHandlers.length; j++) logoutHandlers[j]();
    }
  }

  window.addEventListener('message', onMessage);

  var WorkflowEmbed = {
    /** Registers a callback invoked with (token, claims) whenever a token
     *  becomes available -- once synchronously-ish for a mode-A fragment
     *  token found at load, and again on every mode-B refresh (initial
     *  requestToken() reply, or the SDK's own pre-expiry refresh). Call
     *  this before relying on getIdentity() if you need to react to a
     *  token arriving after this script itself finishes loading. */
    onToken: function (cb) {
      if (typeof cb !== 'function') return;
      tokenHandlers.push(cb);
      if (currentToken !== null) cb(currentToken, currentClaims); // deliver what we already have
    },

    /** Registers a callback invoked when the host broadcasts a logout (the
     *  platform user signed out) -- tear down whatever session onToken
     *  established. Only reachable in mode B (see this file's top doc
     *  comment) -- a mode-A-only embed (no live host connection, e.g.
     *  Android) will never see this and should rely on token expiry
     *  (onExpiring) instead. */
    onLogout: function (cb) {
      if (typeof cb === 'function') logoutHandlers.push(cb);
    },

    /** Registers a callback invoked ~30 seconds before the current token's
     *  `exp`. In mode B the SDK also proactively refreshes at this point
     *  (so onToken fires again shortly with a new token); in mode A there
     *  is no refresh path, so use this to prompt the user to reopen the
     *  page rather than silently failing writes with a stale identity. */
    onExpiring: function (cb) {
      if (typeof cb === 'function') expiringHandlers.push(cb);
    },

    /** Returns the current token's decoded claims, or null if none has
     *  arrived yet. Convenience wrapper over onToken's most recent
     *  delivery -- prefer onToken itself if you need to react to identity
     *  becoming available after this call. NOT signature-verified -- see
     *  this file's top-level doc comment. */
    getIdentity: function () {
      return currentClaims;
    },

    /** Returns the current raw JWT string, or null. Hand this to your own
     *  backend for real signature verification (it holds the integration's
     *  shared secret; this SDK does not) before trusting the identity for
     *  anything privileged. */
    getToken: function () {
      return currentToken;
    },

    /** Asks the host to mint and deliver an SSO token for this integration
     *  (mode B). No-op outside an iframe (nothing to ask) -- safe to call
     *  unconditionally, including from a mode-A-only context like the
     *  Android WebView. The host decides whether to honor the request based
     *  on this frame's origin being in the integration's allowed_origins --
     *  a request from an unlisted origin is silently ignored (no error is
     *  sent back, so an unauthorized origin gets no oracle for "was I
     *  close").
     *
     *  integrationId is optional context for the host if it hosts more than
     *  one integration on the same page (e.g. multiple embed tiles) --
     *  omit it if the host only ever has one for this frame to talk to. */
    requestToken: function (integrationId) {
      if (!isInIframe()) return;
      window.parent.postMessage({ type: 'wf:sso:request', integrationId: integrationId }, '*');
      // '*' here is safe: this message carries no secret, only a request --
      // the host is the only thing that can act on it, and even a
      // misdirected recipient learns nothing beyond "something wants a
      // token", the same as observing any other page load.
    },

    /** Reports this frame's current content height to the host, so a
     *  Dashboard Embed widget's tile can auto-size instead of showing
     *  internal scrollbars. No-op outside an iframe. Call this whenever the
     *  embedded content's layout changes (e.g. after fetching data that
     *  changes page length). Not applicable to a Custom-menu embed page
     *  (full-viewport, not a resizable tile) or the Android WebView, but
     *  harmless to call from either -- both simply have nothing listening. */
    reportHeight: function (height) {
      if (!isInIframe()) return;
      window.parent.postMessage({ type: 'wf:resize', height: height }, '*');
    },
  };

  window.WorkflowEmbed = WorkflowEmbed;

  // Mode A: consume a fragment token immediately on load, with no call
  // required from the embedded page's own script. Runs after
  // window.WorkflowEmbed is assigned so a synchronous onToken() call made
  // immediately after the <script> tag (before this IIFE's tail executes)
  // still sees a fully-formed object, and BEFORE any onToken subscriber
  // could plausibly have been registered by later inline script, so the
  // "deliver what we already have" replay in onToken (above) is what
  // actually gets it to that subscriber -- this bare read here only
  // populates currentToken/currentClaims and schedules expiry.
  var fragmentToken = readFragmentToken();
  if (fragmentToken !== null) deliverToken(fragmentToken);
})(window);
