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
  'detail_tab.default_label.details': 'Detalles',
  'detail_tab.default_label.audit': 'Registro de auditoría',
  'detail_tab.default_label.linked': 'Registros vinculados',
  'detail_tab.default_label.attachments': 'Archivos adjuntos',
  'detail_tab.default_label.tags': 'Etiquetas',
  'detail_tab.default_label.comment': 'Comentarios',
  'detail_tab.default_label.related_form': 'Formulario relacionado',
  'detail_tab.default_label.group': 'Grupo de pestañas',
  'detail_tab.default_label.custom': 'Personalizado',
  'detail_tab.default_label.field_ref': 'Campo',
  'detail_tab.default_label.connections': 'Conexiones',
  'forms.create.success_message': 'Registro creado correctamente.',
  'forms.create.error_message': 'Ocurrió un error al guardar. Inténtalo de nuevo.',
} satisfies Record<string, string>
