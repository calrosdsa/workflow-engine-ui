import { WorkflowBuilderPage, type BuilderMode } from '@/pages/workflows/WorkflowBuilderPage'

export type { BuilderMode }

// The /test/$workflowId route renders the one real builder implementation —
// this used to be a near-duplicate of WorkflowBuilderPage and drifted.
export default function TestLayout({ mode }: { mode: BuilderMode }) {
  return <WorkflowBuilderPage mode={mode} />
}
