// The vocabulary of ways a workflow's singleton Trigger node can fire —
// extracted out of node-forms/TriggerForm.tsx so BOTH that file's own mode
// picker AND the new TriggerOnboardingModal.tsx (a brand-new workflow's
// blank-canvas "What triggers this workflow?" prompt) render the exact same
// list from one source, rather than risking two hand-maintained copies
// drifting apart.
//
// Mirrors internal/graph's TriggerMode enum (configs_trigger.go) — an
// internal-only, code-defined set (see graph.TriggerModes(), which serves
// only the bare value/description pairs a schema needs, not icons or
// picker copy), so this stays a hand-maintained mirror, the same
// convention TriggerForm.tsx's own WEBHOOK_PROVIDERS already uses for ITS
// Go-side source of truth.
import {
  Zap as ZapIcon, MousePointerClick, Clock, ShieldCheck, CheckCircle2, Send,
  Webhook, Workflow as WorkflowIcon, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import type { TriggerMode } from '../types'

export interface TriggerModeOption {
  value: TriggerMode
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
}

export const TRIGGER_MODES: TriggerModeOption[] = [
  { value: 'on_demand',             icon: ZapIcon,            labelKey: 'workflows.trigger.mode.on_demand.label',             descriptionKey: 'workflows.trigger.mode.on_demand.description' },
  { value: 'on_demand_data_driven', icon: MousePointerClick,  labelKey: 'workflows.trigger.mode.on_demand_data_driven.label', descriptionKey: 'workflows.trigger.mode.on_demand_data_driven.description' },
  { value: 'scheduled',             icon: Clock,              labelKey: 'workflows.trigger.mode.scheduled.label',             descriptionKey: 'workflows.trigger.mode.scheduled.description' },
  { value: 'before',                icon: ShieldCheck,        labelKey: 'workflows.trigger.mode.before.label',                descriptionKey: 'workflows.trigger.mode.before.description' },
  { value: 'after',                 icon: CheckCircle2,       labelKey: 'workflows.trigger.mode.after.label',                 descriptionKey: 'workflows.trigger.mode.after.description' },
  { value: 'after_async',           icon: Send,               labelKey: 'workflows.trigger.mode.after_async.label',           descriptionKey: 'workflows.trigger.mode.after_async.description' },
  { value: 'webhook',               icon: Webhook,            labelKey: 'workflows.trigger.mode.webhook.label',               descriptionKey: 'workflows.trigger.mode.webhook.description' },
  { value: 'executed_by_workflow',  icon: WorkflowIcon,       labelKey: 'workflows.trigger.mode.executed_by_workflow.label',  descriptionKey: 'workflows.trigger.mode.executed_by_workflow.description' },
  { value: 'on_error',              icon: AlertTriangle,      labelKey: 'workflows.trigger.mode.on_error.label',              descriptionKey: 'workflows.trigger.mode.on_error.description' },
]
