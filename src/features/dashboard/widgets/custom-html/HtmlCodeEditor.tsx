import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'

interface HtmlCodeEditorProps {
  value: string
  onChange: (v: string) => void
}

// A plain inline CodeMirror instance for the custom-HTML widget — much
// lighter than features/workflows/builder/ExpressionEditor.tsx's dialog
// (no autocomplete-from-variables, no backend-validation linter, no
// preview panel), since none of that applies here: this is raw HTML/embed
// markup, not an Expr expression bound to workflow variables. Same
// underlying CodeMirror wiring (history/lineNumbers/keymap/theme), just the
// html() language extension instead of javascript(), and no lint
// compartment since there's no backend to validate HTML against.
export function HtmlCodeEditor({ value, onChange }: HtmlCodeEditorProps) {
  const domRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!domRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          lineNumbers(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          html(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', overflow: 'hidden' },
            '.cm-content': { fontFamily: "'Fira Mono', 'Cascadia Code', 'Consolas', monospace", padding: '10px 4px', minHeight: '220px', caretColor: '#6366f1' },
            '.cm-focused': { outline: 'none' },
            '&.cm-focused': { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,0.12)' },
            '.cm-gutters': { background: '#f8fafc', border: 'none', borderRight: '1px solid #eef2f6', color: '#cbd5e1' },
            '.cm-lineNumbers .cm-gutterElement': { minWidth: '22px', padding: '0 6px 0 8px' },
            '.cm-activeLine': { background: 'rgba(99,102,241,0.035)' },
            '.cm-activeLineGutter': { background: 'transparent', color: '#94a3b8' },
            '.cm-matchingBracket': { background: 'rgba(99,102,241,0.16)', outline: '1px solid rgba(99,102,241,0.4)', borderRadius: '2px' },
            '.cm-selectionBackground, ::selection': { background: 'rgba(99,102,241,0.18) !important' },
          }),
        ],
      }),
      parent: domRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; value updates are pushed via the effect below, not by recreating the view
  }, [])

  // Push external value changes (e.g. loading a different widget instance)
  // without clobbering the cursor — same pattern ExpressionEditor.tsx uses.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={domRef} className="w-full" />
}
