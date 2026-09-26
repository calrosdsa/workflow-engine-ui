import { useCallback } from 'react'
import { NODE_REGISTRY, leverFor } from './node-registry'
import { useNodeTaxonomy } from './node-taxonomy'
import type { NodeType } from '../types'

// One answer to "which lever colour does this node type carry", for every
// surface that shows node types outside a plate (outline, execution logs,
// minimap). The served taxonomy wins, as it does for the picker and the
// plate itself: a package node is only in the taxonomy, so reading the
// built-in registry alone would paint every package node the logic lever.
export function useLeverOf(): (type: string) => string {
  const { data: taxonomy } = useNodeTaxonomy()
  return useCallback(
    (type: string) => leverFor(
      type,
      taxonomy?.nodes.find((n) => n.type === type)?.category
        ?? NODE_REGISTRY[type as NodeType]?.category,
    ),
    [taxonomy],
  )
}
