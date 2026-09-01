// The ONLY file touched when adding a custom-action type (besides the new
// type's own folder) — mirrors detail-tabs/index.ts's identical role. Each
// import is side-effecting: importing the module runs its own
// registerCustomAction() call at module scope. Must be imported exactly
// once, before any component reads the registry (RecordDetailToolbar.tsx
// does so at its own top level) — see registry.ts's load-order note
// (identical reasoning to detail-tabs/registry.ts's).
import './update-field'
import './trigger-workflow'
import './export-report'
import './run-ui-workflow'
