import { MAX_CUSTOM_TERM_CODE_POINTS } from './config';

export const ADD_SELECTION_MENU_ID = 'scrawlix-add-selection';
export const TEMPORARY_REVEAL_COMMAND = 'temporary-reveal';
export const TEMPORARY_REVEAL_MS = 10_000;

export function customTermFromSelection(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const term = value.trim().replace(/\s+/gu, ' ');
  if (!term) return null;
  if (Array.from(term).length > MAX_CUSTOM_TERM_CODE_POINTS) return null;
  return term;
}
