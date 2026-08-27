import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  createDefaultLocalState,
  updateActiveProfile,
  type ExtensionLens,
  type ExtensionLocalState,
} from './config';
import {
  canReuseSemanticSession,
  presentationSettingsChanged,
  type ExtensionSessionState,
} from './session';

function session(
  localState = createDefaultLocalState(),
  settings = DEFAULT_SETTINGS
): ExtensionSessionState {
  return { settings, localState };
}

function withTermLens(
  state: ExtensionLocalState,
  lens: ExtensionLens,
  active = true
): ExtensionLocalState {
  return updateActiveProfile(
    { ...state, lenses: [...state.lenses, lens] },
    active
      ? { lensIds: [...state.profiles[0]!.lensIds, lens.id] }
      : { lensIds: state.profiles[0]!.lensIds }
  );
}

describe('extension session classification', () => {
  it('reuses semantic work for active-profile appearance and reveal changes', () => {
    const active = session();
    const next = session(
      updateActiveProfile(active.localState, {
        appearance: 'bar',
        reveal: 'click',
      })
    );

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(true);
    expect(presentationSettingsChanged(active, next)).toBe(true);
  });

  it('requires a semantic restart when active-profile coverage changes', () => {
    const active = session();
    const next = session(
      updateActiveProfile(active.localState, { coverage: 'full' })
    );

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(false);
  });

  it('requires a semantic restart when active lens terms change', () => {
    const lens = {
      id: 'lens:private',
      name: 'Private',
      kind: 'terms' as const,
      terms: ['Mothbit'],
    };
    const activeLocal = withTermLens(createDefaultLocalState(), lens);
    const nextLocal = {
      ...activeLocal,
      lenses: activeLocal.lenses.map(candidate =>
        candidate.id === lens.id
          ? { ...candidate, terms: ['Mothbit', 'Project Velvet'] }
          : candidate
      ),
    };

    expect(
      canReuseSemanticSession(session(activeLocal), session(nextLocal), 'example.com')
    ).toBe(false);
  });

  it('reuses semantic work when an inactive lens changes', () => {
    const lens = {
      id: 'lens:spoilers',
      name: 'Spoilers',
      kind: 'terms' as const,
      terms: ['Rosebud'],
    };
    const activeLocal = withTermLens(createDefaultLocalState(), lens, false);
    const nextLocal = {
      ...activeLocal,
      lenses: activeLocal.lenses.map(candidate =>
        candidate.id === lens.id
          ? { ...candidate, terms: ['Rosebud', 'Tyler Durden'] }
          : candidate
      ),
    };

    expect(
      canReuseSemanticSession(session(activeLocal), session(nextLocal), 'example.com')
    ).toBe(true);
    expect(presentationSettingsChanged(session(activeLocal), session(nextLocal))).toBe(
      false
    );
  });

  it('cannot reuse an active session when the site becomes disabled', () => {
    const active = session();
    const next = session(active.localState, { ...DEFAULT_SETTINGS, enabled: false });

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(false);
  });

  it('can reuse when a site override keeps the current host enabled', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      enabled: false,
      siteOverrides: { 'example.com': 'on' as const },
    };
    const active = session(createDefaultLocalState(), settings);
    const next = session(
      updateActiveProfile(active.localState, { appearance: 'blur' }),
      settings
    );

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(true);
  });

  it('ignores unrelated site overrides for presentation work', () => {
    const active = session();
    const next = session(active.localState, {
      ...DEFAULT_SETTINGS,
      siteOverrides: { 'other.example': 'off' as const },
    });

    expect(canReuseSemanticSession(active, next, 'example.com')).toBe(true);
    expect(presentationSettingsChanged(active, next)).toBe(false);
  });
});
