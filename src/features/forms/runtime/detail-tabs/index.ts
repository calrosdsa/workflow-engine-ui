// The ONLY file touched when adding a detail-tab type (besides the new
// type's own folder) — mirrors dashboard/widgets/index.ts's identical role.
// Each import is side-effecting: importing the module runs its own
// registerDetailTab() call at module scope. Must be imported exactly once,
// before any component reads the registry (RecordDetailPanel.tsx does so at
// its own top level) — see registry.ts's load-order note (identical
// reasoning to widget-registry.ts's).
import './built-in'
import './related-form'
import './custom'
import './comment'
import './group'
import './field-ref'
