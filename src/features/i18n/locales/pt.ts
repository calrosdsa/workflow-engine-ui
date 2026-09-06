// Portuguese base dictionary — sibling of en.ts/es.ts. Not every key here
// needs to exist for every key in en.ts: a missing key falls back to en.ts
// (see I18nProvider's resolution order), so this can lag en.ts's growth
// without breaking anything.
export const pt = {
  'common.light': 'Claro',
  'common.dark': 'Escuro',
  'common.system': 'Sistema',
  'profile.account_menu': 'Menu da conta',
  'profile.log_out': 'Sair',
  'profile.language': 'Idioma',
  'profile.theme': 'Tema',
  'menus.module.invalid_nest_toast': 'Um Módulo só pode ser aninhado sob outro Módulo, ou movido para o nível superior.',
  'menus.module.requires_module_parent': 'Disponível apenas no nível superior ou sob outro Módulo.',
  'runtime.home.drilldown_back': 'Voltar',
  'runtime.sidebar.back_to_home': 'Voltar ao início',
} satisfies Record<string, string>
