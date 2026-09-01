// The ONLY file touched when adding a UI workflow node type (besides the new
// node's own file) — mirrors custom-actions/index.ts and detail-tabs/index.ts
// in that role. Each import is side-effecting: importing the module runs its
// own registerUiWorkflowNode() call at module scope. Must be imported exactly
// once, before anything reads the registry.
//
// This is the minimal set the interpreter will implement first. It is
// deliberately NOT the server's 24 node types — see node-registry.ts for why
// reuse would be wrong, and why run_workflow is what keeps this list from
// having to grow an http_request node.
import './condition'
import './set-variable'
import './show-message'
import './navigate'
import './set-field'
import './fetch-records'
import './write-record'
import './run-workflow'
