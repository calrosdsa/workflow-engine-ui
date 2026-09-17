// Pure pre-save validation for ReportSettings.page — kept out of
// PageSetupSection (the panel component) and out of the store, mirroring
// data-sources.ts's own reasoning for pruneIncompleteFilters: the rule
// that matters should be testable without mounting a spreadsheet, and
// callable from ReportBuilderPage's handleSave, which has no reason to
// import a panel component to reach it.
//
// WHY THIS BLOCKS SAVE RATHER THAN SILENTLY FIXING, UNLIKE pruneIncompleteFilters
// -----------------------------------------------------------------------------
// pruneIncompleteFilters drops an unfielded filter condition because doing
// so is provably lossless — a condition with no field expresses no
// constraint. Neither check here has an equivalent safe auto-fix: silently
// completing a half-typed custom width/height is guessing, and silently
// stripping an unrecognized token overrides text the author actually
// typed. So this validates instead of repairing, and ReportBuilderPage
// rejects the save on a non-empty result — the same "prevented, not
// merely flagged" stance PageSetupSection.tsx's patchPage already takes
// for a margin that would leave no room for content, just surfaced at the
// point where an author who never even opened Page Setup would otherwise
// silently persist an invalid definition.
//
// Both cases are already rejected by the backend (PageSetup.Validate in
// definition.go — confirmed via internal/reports/definition_print_test.go's
// TestPageSetup_ValidateRequiresCustomDimensionsForCustomPaperSize, and
// PageSetupSection.tsx's own comment on unknownTokens citing the same
// Validate for the token case), so this is a friendlier pre-flight message
// replacing a raw 400, not a new restriction the backend doesn't already
// enforce.
import type { PageSetup } from './types'
import { PAGE_BAND_TOKENS } from './types'

// Every {{token}} a band zone contains, whether or not it's one
// PAGE_BAND_TOKENS recognizes. Exported so PageSetupSection.tsx's inline,
// while-editing warning and this save-time check can't drift into two
// separate copies of the same rule.
const TOKEN_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g

export function unknownTokens(text: string | undefined): string[] {
  if (!text) return []
  const found = new Set<string>()
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const name = match[1]
    if (!(PAGE_BAND_TOKENS as readonly string[]).includes(name)) found.add(name)
  }
  return [...found]
}

export interface PageSetupProblem {
  /** An i18n key — this module has no useTranslation() to call, so the
   *  caller (ReportBuilderPage, which does) resolves the human-readable
   *  message. */
  key: string
  params?: Record<string, string>
}

/** Everything wrong with page that would make the backend's own Validate
 *  reject it — checked right before the save API call, the same TIMING
 *  pruneIncompleteFilters already runs at in ReportBuilderPage.handleSave,
 *  just not the same silently-repair MECHANISM (see this file's own doc
 *  comment for why). Empty when page is undefined: a report with no page
 *  setup at all has nothing to validate. */
export function validatePageSetup(page: PageSetup | undefined): PageSetupProblem[] {
  if (!page) return []
  const problems: PageSetupProblem[] = []

  if (page.paper_size === 'custom' && (!page.custom_width_mm || !page.custom_height_mm)) {
    problems.push({ key: 'reports.page_setup.custom_size_required' })
  }

  const badTokens = new Set<string>()
  for (const band of [page.header, page.footer]) {
    for (const zone of [band?.left, band?.center, band?.right]) {
      for (const tok of unknownTokens(zone)) badTokens.add(tok)
    }
  }
  if (badTokens.size > 0) {
    problems.push({ key: 'reports.page_setup.unknown_token', params: { token: [...badTokens].join(', ') } })
  }

  return problems
}
