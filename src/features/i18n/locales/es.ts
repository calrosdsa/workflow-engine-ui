// Spanish base dictionary — sibling of en.ts. Not every key here needs to
// exist for every key in en.ts: a missing key falls back to en.ts (see
// I18nProvider's resolution order), so this can lag en.ts's growth without
// breaking anything.
export const es = {
  'common.light': 'Claro',
  'common.dark': 'Oscuro',
  'common.system': 'Sistema',
  'profile.account_menu': 'Menú de cuenta',
  'profile.log_out': 'Cerrar sesión',
  'profile.language': 'Idioma',
  'profile.theme': 'Tema',
  'menus.module.invalid_nest_toast': 'Un Módulo solo puede anidarse bajo otro Módulo, o moverse al nivel superior.',
  'menus.module.requires_module_parent': 'Solo disponible en el nivel superior o bajo otro Módulo.',
  'runtime.home.drilldown_back': 'Atrás',
  'runtime.sidebar.back_to_home': 'Volver al inicio',
} satisfies Record<string, string>
