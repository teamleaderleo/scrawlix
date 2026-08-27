import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './config';
import {
  canReuseSemanticSession,
  presentationSettingsChanged,
} from './session';

describe('extension session classification', () => {
  it('reuses semantic work for appearance and reveal changes', () => {
    const next = {
      ...DEFAULT_SETTINGS,
      appearance: 'bar' as const,
      reveal: 'click' as const,
    };

    expect(canReuseSemanticSession(DEFAULT_SETTINGS, next, 'example.com')).toBe(
      true
    );
    expect(presentationSettingsChanged(DEFAULT_SETTINGS, next)).toBe(true);
  });

  it('requires a semantic restart when coverage changes', () => {
    const next = { ...DEFAULT_SETTINGS, coverage: 'full' as const };

    expect(canReuseSemanticSession(DEFAULT_SETTINGS, next, 'example.com')).toBe(
      false
    );
  });

  it('cannot reuse an active session when the site becomes disabled', () => {
    const next = { ...DEFAULT_SETTINGS, enabled: false };

    expect(canReuseSemanticSession(DEFAULT_SETTINGS, next, 'example.com')).toBe(
      false
    );
  });

  it('can reuse when a site override keeps the current host enabled', () => {
    const active = {
      ...DEFAULT_SETTINGS,
      enabled: false,
      siteOverrides: { 'example.com': 'on' as const },
    };
    const next = { ...active, appearance: 'blur' as const };

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(true);
  });

  it('skips presentation work when only unrelated settings change', () => {
    const next = {
      ...DEFAULT_SETTINGS,
      siteOverrides: { 'other.example': 'off' as const },
    };

    expect(presentationSettingsChanged(DEFAULT_SETTINGS, next)).toBe(false);
  });
});
