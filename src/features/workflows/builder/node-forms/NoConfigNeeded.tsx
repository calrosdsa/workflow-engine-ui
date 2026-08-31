// Shared by entry/exit/merge/loop_end — the four node types with nothing to
// configure. Each is registered as a type's `form` in node-registry.ts, so
// NodeConfigPanel.tsx's dispatch stays unconditional (no special-casing for
// "this type has no config") — both accept (and ignore) the standard
// NodeFormProps so they satisfy the same ComponentType<NodeFormProps> shape
// every other node type's form does.
function Message({ children }: { children: string }) {
  return <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">{children}</p>
}

export function NoAdditionalConfig() {
  return <Message>No additional configuration</Message>
}

export function LoopEndNoConfig() {
  return (
    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
      Marks the end of the loop body.<br />No configuration needed.
    </p>
  )
}
