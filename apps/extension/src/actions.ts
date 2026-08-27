export const ADD_SELECTION_MENU_ID = 'scrawlix-add-selection';
export const TEMPORARY_REVEAL_COMMAND = 'temporary-reveal';
export const TEMPORARY_REVEAL_MS = 10_000;

const MAX_CONTEXT_TERM_GRAPHEMES = 200;

export function customTermFromSelection(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const term = value.trim().replace(/\s+/gu, ' ');
  if (!term) return null;
  if (Array.from(term).length > MAX_CONTEXT_TERM_GRAPHEMES) return null;
  return term;
}
