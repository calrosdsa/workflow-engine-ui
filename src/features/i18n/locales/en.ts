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
} satisfies Record<string, string>
