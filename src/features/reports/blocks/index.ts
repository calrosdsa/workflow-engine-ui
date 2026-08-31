// The ONLY file touched when adding a report block type (besides the new
// type's own folder) — mirrors features/dashboard/widgets/index.ts's
// identical role. Each import is side-effecting: importing the module runs
// its own registerReportBlock() call at module scope.
import './table'
import './group'
import './related'
import './text'
import './image'
