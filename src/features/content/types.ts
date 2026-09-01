// Wire shape returned by workflow-engine's api/content handler
// (objectResponse in api/content/handler.go) — every /content route.
export interface ContentObject {
  id: string
  owner_kind: 'form_record' | 'kb_document' | 'app_asset' | 'menu_icon'
  owner_resource_id: string
  filename: string
  content_type: string
  size_bytes: number
  checksum_sha256: string
  created_by?: string
  created_at: string
}

// The value a File Upload / Image Upload form field stores in its record
// (internal/forms/field's TypeFile doc comment, v0.4 shape) — content_id is
// authoritative; filename/content_type/size_bytes are a cached display copy
// so a list view can show them without a round trip to GET /content/{id}.
export interface FileFieldValue {
  content_id: string
  filename: string
  content_type: string
  size_bytes: number
}
