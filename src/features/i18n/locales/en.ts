// Base English dictionary — the fallback every key resolves to when neither
// the current locale's app override nor its own base entry exists. This IS
// the key catalog: LocalizationSection (the design-app management UI) reads
// its rows straight from this object rather than any separate registry, so
// a key becomes translatable simply by being used via t() and added here.
//
// Grows page by page as components adopt t() instead of literal strings —
// see workflow-engine-ui/CLAUDE.md. Keys are dot-namespaced by the area that
// owns them (profile.*, common.*, ...).
export const en = {
  'common.light': 'Light',
  'common.dark': 'Dark',
  'common.system': 'System',
  'profile.account_menu': 'Account menu',
  'profile.log_out': 'Log out',
  'profile.language': 'Language',
  'profile.theme': 'Theme',
  'menus.module.invalid_nest_toast': 'A Module can only be nested under another Module, or moved to the top level.',
  'menus.module.requires_module_parent': 'Only available at the top level or under another Module.',
  'runtime.home.drilldown_back': 'Back',
  'runtime.sidebar.back_to_home': 'Back to Home',
  'connections.tab.empty': 'No connections configured yet.',
  'connections.tab.count_unknown': '—',
  'connections.tile.create_tooltip': 'Create a new {{form}}',
  'connections.tile.expand_tooltip': 'View linked {{form}} records',
  'connections.dialog.create_title': 'New {{form}}',
  'connections.dialog.create_error': 'Something went wrong while saving. Please try again.',
  'connections.config.add_connection': 'Add connection',
  'connections.config.pick_form': 'Pick a form…',
  'connections.config.pick_field': 'Linked via field',
  'connections.config.pick_menu': 'On click, go to',
  'connections.config.category': 'Category',
  'connections.config.category_placeholder': 'e.g. Buy, Sell, Manufacture',
  'connections.config.label_override': 'Tile label',
  'connections.config.quick_create_mode': 'Quick-create (+)',
  'connections.config.quick_create_dialog': 'Inline dialog',
  'connections.config.quick_create_page': 'Full page (no prefill)',
  'connections.config.quick_create_off': 'No quick-create',
  'connections.config.duplicate_entry': 'This form + field is already added.',
  'connections.config.category_order': 'Category order',
  'connections.config.category_order_hint': 'Controls the left-to-right order of category headers.',
  'connections.config.category_hint': 'Free text — tiles group under matching category names.',
  'connections.config.pick_menu_hint': 'Only Search menus for this form are listed. None: expand an inline list instead.',
  'connections.config.pick_menu_none': 'None (expand inline)',
  'connections.config.add_form_hint': 'Only forms with a field that references this form are listed.',
  'connections.config.pick_field_hint': 'Which reference field on that form points back at this one.',
  'connections.config.no_matching_field': 'This form has no field referencing back — pick a different one.',
  'connections.config.empty_state': 'No connections yet — add one below.',
  'attachments.tab.empty': 'No attachments yet.',
  'attachments.tab.upload': 'Upload file',
  'attachments.tab.uploading': 'Uploading…',
  'attachments.tab.no_permission': 'You do not have permission to attach files to this record.',
  'attachments.tab.delete_title': 'Delete this attachment?',
  'attachments.tab.delete_description': 'This action can\'t be undone.',
  'attachments.tab.delete_confirm': 'Delete',
  'attachments.tab.upload_error': 'Upload failed. Please try again.',
  'attachments.tab.upload_loading': 'Uploading "{{filename}}"…',
  'attachments.tab.upload_success': '"{{filename}}" uploaded',
  'attachments.tab.delete_success': '"{{filename}}" deleted',
  'attachments.tab.delete_error': 'Delete failed. Please try again.',
  'tags.tab.empty': 'No tags yet.',
  'tags.tab.placeholder': 'Add a tag…',
  'tags.tab.add': 'Add',
  'tags.tab.no_permission': 'You do not have permission to tag this record.',
  'tags.tab.remove': 'Remove tag',
  'tags.tab.add_success': '"{{tag}}" added',
  'tags.tab.add_error': 'Could not add tag. Please try again.',
  'tags.tab.remove_success': '"{{tag}}" removed',
  'tags.tab.remove_error': 'Could not remove tag. Please try again.',
  // Fixed platform default shown as a detail tab's name when its admin has
  // not typed a custom label override (DetailTabConfig.label unset) — one
  // entry per registered detail-tab type (detail-tabs/registry.ts). NOT
  // shown in the Form Builder's own tab-catalog UI (design-time chrome
  // stays English-only by convention); only DetailTabList.tsx's runtime
  // render reads these.
  'detail_tab.default_label.details': 'Details',
  'detail_tab.default_label.audit': 'Audit Log',
  'detail_tab.default_label.linked': 'Linked Records',
  'detail_tab.default_label.attachments': 'Attachments',
  'detail_tab.default_label.tags': 'Tags',
  'detail_tab.default_label.comment': 'Comments',
  'detail_tab.default_label.related_form': 'Related Form',
  'detail_tab.default_label.group': 'Tab Group',
  'detail_tab.default_label.custom': 'Custom',
  'detail_tab.default_label.field_ref': 'Field',
  'detail_tab.default_label.connections': 'Connections',
  // Shared by AddMenuRuntime.tsx and RuntimeFormCreatePage.tsx (the
  // formId-direct, menu-less counterpart of the same create flow) — fixed
  // chrome, not per-app content. success_message doubles as the tc()
  // fallback when a menu's own AddMenuConfig.success_message is unset.
  'forms.create.success_message': 'Record created successfully.',
  'forms.create.error_message': 'Something went wrong while saving. Please try again.',
  // Report builder's on-screen preview (ReportPreviewDialog). It shows the
  // real generated file, so "not viewable" is about the BROWSER lacking a
  // renderer for that format, never about the report failing to generate —
  // the wording keeps those two apart on purpose.
  'reports.preview.title': 'Preview',
  'reports.preview.untitled': 'Untitled report',
  'reports.preview.generating': 'Generating preview…',
  'reports.preview.failed': "Couldn't generate this report",
  'reports.preview.row_count_one': '1 row',
  'reports.preview.row_count_other': '{{count}} rows',
  'reports.preview.download': 'Download',
  'reports.preview.not_viewable': '{{format}} files open in a spreadsheet or word processor',
  'reports.preview.not_viewable_hint':
    'Your browser has no viewer for this format. Download the file to check it, or switch to PDF to see the page layout on screen.',
  'reports.preview.download_to_view': 'Download to view',
  'reports.preview.view_pdf_instead': 'View as PDF',

  'reports.number_format.heading': 'Number format',
  'reports.number_format.open': 'Format selected cells',
  'reports.number_format.clear': 'Clear',
  'reports.number_format.style': 'Style',
  'reports.number_format.style_number': 'Number',
  'reports.number_format.style_currency': 'Currency',
  'reports.number_format.style_percent': 'Percent',
  'reports.number_format.decimals': 'Decimals',
  'reports.number_format.symbol': 'Symbol',
  'reports.number_format.symbol_position': 'Symbol position',
  'reports.number_format.symbol_prefix': 'Before the number',
  'reports.number_format.symbol_suffix': 'After the number',
  'reports.number_format.thousands': 'Thousands',
  'reports.number_format.no_grouping': 'No grouping',
  'reports.number_format.decimal': 'Decimal',
  'reports.number_format.negatives': 'Negatives',
  'reports.number_format.preview': 'Preview',
  'reports.number_format.column_none': 'Plain',
  'reports.number_format.done': 'Done',
  'reports.number_format.locale_note':
    "These separators apply to PDF, Word, Markdown and CSV. A spreadsheet always draws its own from the reader's regional settings, so the grid here and a downloaded Excel file may show {{sample}} instead.",

  // Report menu runtime viewer's client-side pager (ReportMenuRuntime.tsx) —
  // row_count_one/row_count_other above are reused for the row-count label.
  'reports.runtime.page_size_option': '{{count}} / page',

  // Dashboard chart widget's runtime-only viewer controls (RuntimeToolbar.tsx
  // / ChartMenu.tsx) — time range, bucket, ad-hoc filter, and the "..." menu.
  // Never shown in the Dashboard Builder's own config-panel preview.
  'runtime.dashboard_chart.synced_just_now': 'Synced just now',
  'runtime.dashboard_chart.synced_minutes_ago': 'Synced {{n}}m ago',
  'runtime.dashboard_chart.synced_hours_ago': 'Synced {{n}}h ago',
  'runtime.dashboard_chart.synced_days_ago': 'Synced {{n}}d ago',
  'runtime.dashboard_chart.apply': 'Apply',
  'runtime.dashboard_chart.cancel': 'Cancel',
  'runtime.dashboard_chart.range.label': 'Time range',
  'runtime.dashboard_chart.range.last_week': 'Last Week',
  'runtime.dashboard_chart.range.last_month': 'Last Month',
  'runtime.dashboard_chart.range.last_quarter': 'Last Quarter',
  'runtime.dashboard_chart.range.last_year': 'Last Year',
  'runtime.dashboard_chart.range.custom': 'Custom range',
  'runtime.dashboard_chart.range.to': 'to',
  'runtime.dashboard_chart.range.clear': 'Clear time range',
  'runtime.dashboard_chart.bucket.label': 'Group by: {{value}}',
  'runtime.dashboard_chart.bucket.none': 'Exact value',
  'runtime.dashboard_chart.bucket.day': 'Day',
  'runtime.dashboard_chart.bucket.week': 'Week',
  'runtime.dashboard_chart.bucket.month': 'Month',
  'runtime.dashboard_chart.bucket.quarter': 'Quarter',
  'runtime.dashboard_chart.bucket.year': 'Year',
  'runtime.dashboard_chart.filter.label': 'Filter',
  'runtime.dashboard_chart.menu.label': 'Chart options',
  'runtime.dashboard_chart.menu.refresh': 'Refresh',
  'runtime.dashboard_chart.menu.reset': 'Reset',
  'runtime.dashboard_chart.menu.export': 'Export CSV',
  'runtime.dashboard_chart.menu.view_records': 'View records',
} satisfies Record<string, string>
