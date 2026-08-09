/**
 * Embedded Integration SDK — include this script in a partner page that's
 * iframed into a dashboard's Embed widget, to receive the current user's
 * identity via SSO instead of requiring a separate login.
 *
 * See docs/dashboard-system-plan.md section 8.2 ("Embed SDK handshake") for
 * the full protocol design. This file is the CHILD (partner-page) side of
 * the handshake; the PARENT (dashboard) side lives in
 * features/dashboard/widgets/embed/Renderer.tsx.
 *
 * Usage in a partner page:
 *
 *   <script src="https://your-platform.example.com/embed-sdk.js"></script>
 *   <script>
 *     WorkflowEmbed.onToken(function (token) {
 *       // Verify `token` (a JWT) against your integration's shared secret,
 *       // then establish your own in-memory session from its claims.
 *     });
 *     WorkflowEmbed.onLogout(function () {
 *       // Tear down whatever session onToken established.
 *     });
 *     WorkflowEmbed.requestToken();
 *   </script>
 *
 * Security model: every message this SDK sends or accepts is checked
 * against the parent's actual origin (window.location.ancestorOrigins when
 * available, falling back to only ever trusting the FIRST origin a
 * `wf:sso:token`/`wf:sso:logout` message arrives from — see
 * acceptedParentOrigin below). This SDK never uses `postMessage(..., '*')`
 * to send the token onward or accepts a token relayed by anything other
 * than the direct parent window. The corresponding server-side check (is
 * THIS partner's origin in the integration's allowed_origins?) happens on
 * the dashboard side, not here — this SDK has no way to enforce that policy
 * itself, since it doesn't hold the integration's configuration.
 */
(function (window) {
  'use strict';

  if (window.WorkflowEmbed) return; // idempotent if the script is included twice

  var tokenHandlers = [];
  var logoutHandlers = [];
  var acceptedParentOrigin = null; // pinned to the first legitimate reply's origin

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // a cross-origin access error itself implies framing
    }
  }

  function onMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    var type = event.data.type;
    if (type !== 'wf:sso:token' && type !== 'wf:sso:logout') return;

    // Pin to the first origin that ever sends us a real SSO message, then
    // require every subsequent message match it — this SDK has no
    // allowlist of its own (only the parent's own allowed_origins check
    // knows that), so "same origin as last time" is the only self-defense
    // available here against a *different* frame injecting messages.
    if (acceptedParentOrigin === null) {
      acceptedParentOrigin = event.origin;
    } else if (event.origin !== acceptedParentOrigin) {
      return;
    }

    if (type === 'wf:sso:token') {
      var token = event.data.token;
      if (typeof token !== 'string' || !token) return;
      for (var i = 0; i < tokenHandlers.length; i++) tokenHandlers[i](token);
    } else if (type === 'wf:sso:logout') {
      for (var j = 0; j < logoutHandlers.length; j++) logoutHandlers[j]();
    }
  }

  window.addEventListener('message', onMessage);

  var WorkflowEmbed = {
    /** Registers a callback invoked with the raw JWT string whenever the
     *  parent delivers one — on initial requestToken() and on any silent
     *  refresh the parent performs before the token's exp. Call this before
     *  requestToken() so no delivery is missed. */
    onToken: function (cb) {
      if (typeof cb === 'function') tokenHandlers.push(cb);
    },

    /** Registers a callback invoked when the parent broadcasts a logout
     *  (the platform user signed out of the dashboard) — tear down whatever
     *  session onToken established. */
    onLogout: function (cb) {
      if (typeof cb === 'function') logoutHandlers.push(cb);
    },

    /** Asks the parent dashboard to mint and deliver an SSO token for this
     *  integration. No-op outside an iframe (nothing to ask). The parent
     *  decides whether to honor the request based on this frame's origin
     *  being in the integration's allowed_origins — a request from an
     *  unlisted origin is silently ignored (no error is sent back, so an
     *  unauthorized origin gets no oracle for "was I close").
     *
     *  integrationId is optional context for the parent if it hosts more
     *  than one integration on the same page (e.g. multiple embed tiles) —
     *  omit it if the parent only ever has one for this frame to talk to. */
    requestToken: function (integrationId) {
      if (!isInIframe()) return;
      window.parent.postMessage({ type: 'wf:sso:request', integrationId: integrationId }, '*');
      // '*' here is safe: this message carries no secret, only a request —
      // the parent is the only thing that can act on it, and even a
      // misdirected recipient learns nothing beyond "something wants a
      // token", the same as observing any other page load.
    },

    /** Reports this frame's current content height to the parent, so the
     *  Embed widget's tile can auto-size instead of showing internal
     *  scrollbars. Call this whenever the embedded content's layout
     *  changes (e.g. after fetching data that changes page length). */
    reportHeight: function (height) {
      if (!isInIframe()) return;
      window.parent.postMessage({ type: 'wf:resize', height: height }, '*');
    },
  };

  window.WorkflowEmbed = WorkflowEmbed;
})(window);
