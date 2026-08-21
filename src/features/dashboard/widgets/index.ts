// The ONLY file touched when adding a widget type (besides the new widget's
// own folder) — see docs/dashboard-system-plan.md section 4.3, and
// docs/writing-a-widget.md for the full step-by-step guide. Each import
// below is side-effecting: importing the module runs its registerWidget()
// call at module scope. Order doesn't matter — widget-registry.ts throws on
// a duplicate type in production, but silently overwrites in dev, since
// Vite's HMR can re-run these imports from several different propagation
// paths (see registerWidget's own doc comment for why a
// dispose-and-clear approach here proved unreliable). This file must still
// be imported exactly once, as early as possible (before any component
// reads the registry) — see widget-registry.ts's load-order note.
import './heading'
import './paragraph'
import './richtext'
import './image'
import './divider'
import './spacer'
import './button'
import './quick-links'
import './table'
import './chart'
import './custom-html'
import './embed'
