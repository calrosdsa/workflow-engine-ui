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
} satisfies Record<string, string>
