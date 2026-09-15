import { describe, expect, it } from 'vitest';
import { customTermFromSelection } from './actions';
import { MAX_CUSTOM_TERM_CODE_POINTS } from './config';

describe('selection terms', () => {
  it('normalizes selection whitespace before adding a term', () => {
    expect(customTermFromSelection('  Project\n\tVelvet  ')).toBe('Project Velvet');
  });

  it('rejects empty and over-length selections', () => {
    expect(customTermFromSelection('   ')).toBeNull();
    expect(
      customTermFromSelection('x'.repeat(MAX_CUSTOM_TERM_CODE_POINTS + 1))
    ).toBeNull();
  });
});
