import type {
  GraphNode, TriggerConfig, SetVariableConfig, ConditionConfig, IteratorConfig,
  HttpRequestConfig, ShowMessageConfig, TransformConfig, SaveRecordsConfig,
} from '../types'

/**
 * Returns a short human message when the node still needs configuration
 * before it can run, or null when it's ready. Mirrors the "Not configured"
 * checks in BaseNode's body previews and the backend's per-node Validate()
 * requirements (internal/graph/validate.go) — intentionally lenient: it only
 * flags the one thing a node cannot run without, never style preferences.
 */
export function nodeSetupIssue(data: GraphNode): string | null {
  const cfg = data.configuration as Record<string, unknown> | undefined
  switch (data.type) {
    case 'trigger': {
      const c = cfg as TriggerConfig | undefined
      if (!c?.mode) return 'Choose a trigger mode'
      if (c.mode === 'scheduled' && !c.cron) return 'Set a cron schedule'
      if ((c.mode === 'before' || c.mode === 'after' || c.mode === 'after_async') && (!c.form_id || !c.event_type)) {
        return 'Pick a form and event'
      }
      return null
    }
    case 'set_variable': {
      const c = cfg as SetVariableConfig | undefined
      const assignments = c?.assignments ?? []
      // Legacy single-assignment payloads (pre-normalisation) count as configured.
      if (assignments.length === 0 && !cfg?.variable_name) return 'Add an assignment'
      if (assignments.some((a) => !a.variable_name)) return 'Name every assignment'
      return null
    }
    case 'condition':
      return (cfg as ConditionConfig | undefined)?.expression ? null : 'Write a branch expression'
    case 'subflow':
      return (cfg as { definition_id?: string } | undefined)?.definition_id ? null : 'Link a workflow'
    case 'fetch_records':
    case 'upsert_records':
    case 'update_records':
    case 'delete_records':
      return (cfg as { form_id?: string } | undefined)?.form_id ? null : 'Pick a form'
    case 'iterator':
      return (cfg as IteratorConfig | undefined)?.source_expr ? null : 'Set the source list'
    case 'transform': {
      const c = cfg as TransformConfig | undefined
      if (!c?.source_expr) return 'Set the source list'
      if (!c?.form_id) return 'Pick a target form'
      if (!c?.mappings?.length) return 'Add a field mapping'
      return null
    }
    case 'save_records': {
      const c = cfg as SaveRecordsConfig | undefined
      if (!c?.form_id) return 'Pick a form'
      if (!c?.source_expr) return 'Set the records to save'
      return null
    }
    case 'http_request': {
      const c = cfg as HttpRequestConfig | undefined
      const url = c?.url_mode === 'expression' ? c?.url_expr : c?.url
      return url ? null : 'Set the request URL'
    }
    case 'show_message':
      return (cfg as ShowMessageConfig | undefined)?.message ? null : 'Write a message'
    default:
      return null // entry / exit / merge / loop_end need no configuration
  }
}
