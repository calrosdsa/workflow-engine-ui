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
  'detail_tab.default_label.details': 'Detalhes',
  'detail_tab.default_label.audit': 'Registro de auditoria',
  'detail_tab.default_label.linked': 'Registros vinculados',
  'detail_tab.default_label.attachments': 'Anexos',
  'detail_tab.default_label.tags': 'Marcadores',
  'detail_tab.default_label.comment': 'Comentários',
  'detail_tab.default_label.related_form': 'Formulário relacionado',
  'detail_tab.default_label.group': 'Grupo de abas',
  'detail_tab.default_label.custom': 'Personalizado',
  'detail_tab.default_label.field_ref': 'Campo',
  'detail_tab.default_label.connections': 'Conexões',
  'forms.create.success_message': 'Registro criado com sucesso.',
  'forms.create.error_message': 'Ocorreu um erro ao salvar. Tente novamente.',
} satisfies Record<string, string>
