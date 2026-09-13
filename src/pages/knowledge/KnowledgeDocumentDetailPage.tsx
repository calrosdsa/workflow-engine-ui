import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle, MiniMap, Position, ReactFlow, type EdgeProps, type NodeProps } from '@xyflow/react'
import { ArrowLeft, FileText, Maximize2, Network, Search, Boxes } from 'lucide-react'
import { useDocumentChunks, useDocumentContent, useDocumentGraph, useKnowledgeDocument } from '@/features/knowledge/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GraphEntity, GraphRelation } from '@/features/knowledge/types'
import { graphFlowData, type DocumentGraphEdge, type DocumentGraphNode } from './document-graph-layout'
import './knowledge-document-graph.css'

export function KnowledgeDocumentDetailPage() {
  const { appId, kbId, docId } = useParams({ from: '/shell/applications/$appId/knowledge-bases/$kbId/documents/$docId' })
  const t = useTranslation()
  const [search, setSearch] = useState('')
  const { data: document, isLoading: documentLoading } = useKnowledgeDocument(kbId, docId)
  const content = useDocumentContent(kbId, docId)
  const chunks = useDocumentChunks(kbId, docId)
  const graph = useDocumentGraph(kbId, docId, true)

  const filteredChunks = useMemo(() => {
    const all = chunks.data?.chunks ?? []
    const query = search.trim().toLowerCase()
    return query ? all.filter((chunk) => chunk.content.toLowerCase().includes(query)) : all
  }, [chunks.data?.chunks, search])
  const hasGraph = (graph.data?.entities.length ?? 0) > 0 || (graph.data?.relations.length ?? 0) > 0

  if (documentLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!document) return <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">{t('knowledge.document.not_found')}</div>

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[hsl(var(--background))]">
      <header className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 sm:px-6">
        <Link
          to="/applications/$appId/knowledge-bases/$kbId"
          params={{ appId, kbId }}
          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft size={13} /> {t('knowledge.document.back')}
        </Link>
        <div className="mt-2 flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 text-[hsl(var(--primary))]">
            <FileText size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-[hsl(var(--foreground))]">{document.file_path || t('knowledge.document.untitled')}</h1>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {t('knowledge.document.metadata', { chunks: document.chunks_count ?? 0, entities: document.entities_count ?? 0, relations: document.relations_count ?? 0 })}
            </p>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] lg:overflow-hidden">
        <section className="flex min-h-[24rem] min-w-0 flex-col border-b border-[hsl(var(--border))] p-4 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('knowledge.document.source_title')}</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('knowledge.document.source_description')}</p>
            </div>
            {content.data?.truncated && <span className="text-xs text-[hsl(var(--warning))]">{t('knowledge.document.preview_truncated')}</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            {content.isLoading && <LoadingState label={t('knowledge.document.loading_source')} />}
            {content.isError && <EmptyState icon={<FileText size={20} />} title={t('knowledge.document.source_unavailable')} description={t('knowledge.document.source_unavailable_description')} />}
            {content.data && (
              <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-[hsl(var(--foreground))]">{content.data.content}</pre>
            )}
          </div>
        </section>

        <section className="flex min-h-[30rem] min-w-0 flex-col p-4 lg:min-h-0 lg:p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('knowledge.document.inspection_title')}</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('knowledge.document.inspection_description')}</p>
          </div>
          <Tabs defaultValue="chunks" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="shrink-0">
              <TabsTrigger value="chunks" className="gap-1.5"><Boxes size={14} /> {t('knowledge.document.chunks_tab', { count: document.chunks_count ?? 0 })}</TabsTrigger>
              <TabsTrigger value="graph" className="gap-1.5"><Network size={14} /> {t('knowledge.document.graph_tab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="chunks" className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('knowledge.document.chunks_description')}</p>
                <div className="relative w-52 max-w-[55%]">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-8 text-xs" placeholder={t('knowledge.document.search_chunks')} aria-label={t('knowledge.document.search_chunks')} />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
                {chunks.isLoading && <LoadingState label={t('knowledge.document.loading_chunks')} />}
                {chunks.isError && <EmptyState icon={<Boxes size={20} />} title={t('knowledge.document.chunks_unavailable')} description={t('knowledge.document.chunks_unavailable_description')} />}
                {!chunks.isLoading && !chunks.isError && filteredChunks.length === 0 && <EmptyState icon={<Search size={20} />} title={t('knowledge.document.no_chunks')} description={search ? t('knowledge.document.no_chunks_search') : t('knowledge.document.no_chunks_description')} />}
                {filteredChunks.map((chunk) => (
                  <article key={chunk.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium text-[hsl(var(--foreground))]">{t('knowledge.document.chunk_number', { number: chunk.order + 1 })}</span>
                      <span>{t('knowledge.document.token_count', { count: chunk.tokens })}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[hsl(var(--foreground))]">{chunk.content}</p>
                  </article>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="graph" className="min-h-0 flex-1">
              {graph.isLoading && <LoadingState label={t('knowledge.document.loading_graph')} />}
              {!graph.isLoading && !hasGraph && <EmptyState icon={<Network size={20} />} title={t('knowledge.document.no_graph')} description={t('knowledge.document.no_graph_description')} />}
              {!graph.isLoading && hasGraph && <DocumentRelationGraph entities={graph.data?.entities ?? []} relations={graph.data?.relations ?? []} />}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex h-full min-h-36 items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Spinner className="h-4 w-4" /> {label}</div>
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex h-full min-h-36 flex-col items-center justify-center px-5 text-center">
      <div className="mb-2 text-[hsl(var(--muted-foreground))]">{icon}</div>
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>
    </div>
  )
}

function DocumentRelationGraph({ entities, relations }: { entities: GraphEntity[]; relations: GraphRelation[] }) {
  const t = useTranslation()
  const [fullscreen, setFullscreen] = useState(false)
  const { nodes, edges } = useMemo(() => graphFlowData(entities, relations), [entities, relations])

  return (
    <>
      <div className="relative h-full min-h-[24rem] overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <GraphCanvas nodes={nodes} edges={edges} ariaLabel={t('knowledge.document.graph_aria')} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-3 top-3 z-10 h-8 w-8 bg-[hsl(var(--card))]"
          aria-label={t('knowledge.document.expand_graph')}
          title={t('knowledge.document.expand_graph')}
          onClick={() => setFullscreen(true)}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </Button>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 pr-14">
            <DialogTitle>{t('knowledge.document.graph_tab')}</DialogTitle>
            <DialogDescription>{t('knowledge.document.graph_fullscreen_description')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            <GraphCanvas nodes={nodes} edges={edges} ariaLabel={t('knowledge.document.graph_fullscreen_aria')} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function GraphCanvas({ nodes, edges, ariaLabel }: { nodes: DocumentGraphNode[]; edges: DocumentGraphEdge[]; ariaLabel: string }) {
  return (
    <ReactFlow
      className="document-graph-flow"
      colorMode="dark"
      nodes={nodes}
      edges={edges}
      nodeTypes={documentGraphNodeTypes}
      edgeTypes={documentGraphEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.2}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      aria-label={ariaLabel}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="hsl(var(--border))" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor="hsl(var(--primary))"
        nodeStrokeWidth={0}
        maskColor="hsl(var(--background) / 0.72)"
      />
    </ReactFlow>
  )
}

function DocumentGraphNodeCard({ data }: NodeProps<DocumentGraphNode>) {
  const t = useTranslation()
  return (
    <div title={data.description || data.name} className="h-full w-full overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!pointer-events-none !border-0 !bg-transparent !opacity-0" />
      <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{data.name}</p>
      <p className="mt-0.5 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{data.type || t('knowledge.document.unknown_type')}</p>
      <Handle type="source" position={Position.Right} className="!pointer-events-none !border-0 !bg-transparent !opacity-0" />
    </div>
  )
}

const documentGraphNodeTypes = { documentGraphNode: DocumentGraphNodeCard }
const documentGraphEdgeTypes = { documentGraphEdge: DocumentGraphEdgeLine }

function DocumentGraphEdgeLine({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style, data }: EdgeProps<DocumentGraphEdge>) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12 })

  if (!data?.label) {
    return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute max-w-[9.5rem] truncate rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-0.5 text-[10px] leading-4 text-[hsl(var(--muted-foreground))] shadow-sm"
          style={{ transform: `translate(-50%, -50%) translate(${data.labelX}px,${data.labelY}px)` }}
          title={data.label}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
