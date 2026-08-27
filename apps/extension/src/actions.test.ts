import { describe, expect, it } from 'vitest';
import { customTermFromSelection } from './actions';

describe('extension interaction helpers', () => {
  it('turns a multiline selection into one compact custom phrase', () => {
    expect(customTermFromSelection('  Project\n\tVelvet  ')).toBe('Project Velvet');
  });

  it('rejects empty and non-string selections', () => {
    expect(customTermFromSelection(' \n\t ')).toBeNull();
    expect(customTermFromSelection(undefined)).toBeNull();
    expect(customTermFromSelection(42)).toBeNull();
  });

  it('caps context-menu additions at 200 Unicode code points', () => {
    expect(customTermFromSelection('x'.repeat(200))).toBe('x'.repeat(200));
    expect(customTermFromSelection('x'.repeat(201))).toBeNull();
  });
});
