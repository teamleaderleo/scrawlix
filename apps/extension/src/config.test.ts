import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  ENGLISH_PROFANITY_LENS_ID,
  MAX_CUSTOM_TERM_CODE_POINTS,
  MAX_CUSTOM_TERMS,
  MAX_CUSTOM_TOTAL_CODE_POINTS,
  activeProfile,
  coverageSelector,
  createDefaultLocalState,
  effectiveEnabled,
  maskFor,
  mergeCustomWords,
  normalizeCustomWords,
  normalizeLocalState,
  normalizeSettings,
  profileTerms,
  profileUsesEnglishProfanity,
  setActiveProfile,
  setSiteMode,
  siteModeFor,
  updateActiveProfile,
} from './config';

describe('extension settings', () => {
  it('normalizes invalid stored values to safe defaults and migrates focus reveal', () => {
    expect(
      normalizeSettings({
        enabled: 'yes',
        appearance: 'paint',
        coverage: 'random',
        reveal: 'focus',
        siteOverrides: {
          'Example.COM': 'off',
          'bad.example': 'inherit',
          '': 'on',
        },
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      reveal: 'click',
      siteOverrides: { 'example.com': 'off' },
    });
  });

  it('treats pause as a true master state before site policy', () => {
    const defaultOff = { ...DEFAULT_SETTINGS, enabled: false };
    const forcedOn = setSiteMode(defaultOff, 'example.com', 'on');
    expect(siteModeFor(forcedOn, 'example.com')).toBe('on');
    expect(effectiveEnabled(forcedOn, 'example.com')).toBe(true);

    const paused = { ...forcedOn, paused: true };
    expect(effectiveEnabled(paused, 'example.com')).toBe(false);

    const forcedOff = setSiteMode(DEFAULT_SETTINGS, 'example.com', 'off');
    expect(effectiveEnabled(forcedOff, 'example.com')).toBe(false);
  });

  it('removes a site override when mode returns to inherit', () => {
    const withOverride = setSiteMode(DEFAULT_SETTINGS, 'Example.COM', 'off');
    const inherited = setSiteMode(withOverride, 'example.com', 'inherit');

    expect(inherited.siteOverrides).toEqual({});
    expect(siteModeFor(inherited, 'example.com')).toBe('inherit');
  });

  it('deduplicates, trims, and bounds custom terms', () => {
    expect(
      normalizeCustomWords([' Velvet ', 'velvet', '', 42, 'Mothbit', 'MOTHBIT'])
    ).toEqual(['Velvet', 'Mothbit']);

    const tooLong = 'x'.repeat(MAX_CUSTOM_TERM_CODE_POINTS + 1);
    const many = Array.from({ length: MAX_CUSTOM_TERMS + 10 }, (_, index) =>
      `term-${index}`
    );
    const normalized = normalizeCustomWords([tooLong, ...many]);
    expect(normalized).toHaveLength(MAX_CUSTOM_TERMS);
    expect(normalized).not.toContain(tooLong);
    expect(
      normalized.reduce((total, term) => total + Array.from(term).length, 0)
    ).toBeLessThanOrEqual(MAX_CUSTOM_TOTAL_CODE_POINTS);
  });

  it('reports custom-term merge outcomes while preserving remaining capacity', () => {
    const result = mergeCustomWords(
      ['Alpha'],
      [
        'alpha',
        'x'.repeat(MAX_CUSTOM_TERM_CODE_POINTS + 1),
        'Bravo',
        'Charlie',
      ],
      {
        count: MAX_CUSTOM_TERMS - 2,
        codePoints: MAX_CUSTOM_TOTAL_CODE_POINTS - 20,
      }
    );

    expect(result.words).toEqual(['Alpha', 'Bravo']);
    expect(result.duplicates).toBe(1);
    expect(result.overLength).toBe(1);
    expect(result.added).toBe(1);
    expect(result.overCapacity).toBe(1);
  });

  it('migrates old treatment and custom words into an Everyday profile', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      appearance: 'bar' as const,
      coverage: 'full' as const,
      reveal: 'click' as const,
    };
    const state = createDefaultLocalState(settings, [
      ' Project Velvet ',
      'velvet',
    ]);
    const profile = activeProfile(state);

    expect(profile).toMatchObject({
      name: 'Everyday',
      appearance: 'bar',
      coverage: 'full',
      reveal: 'click',
    });
    expect(profile.lensIds).toEqual([
      ENGLISH_PROFANITY_LENS_ID,
      'lens:my-terms',
    ]);
    expect(profileTerms(state)).toEqual(['Project Velvet', 'velvet']);
    expect(profileUsesEnglishProfanity(state)).toBe(true);
  });

  it('normalizes local lenses and profiles while dropping missing references', () => {
    const state = normalizeLocalState({
      lenses: [
        {
          id: 'private',
          name: ' Client privacy ',
          kind: 'terms',
          terms: [' Alice ', 'alice', 'Project Velvet'],
        },
        {
          id: ENGLISH_PROFANITY_LENS_ID,
          name: 'fake built in',
          kind: 'terms',
          terms: ['nope'],
        },
      ],
      profiles: [
        {
          id: 'presentation',
          name: ' Presentation ',
          lensIds: ['private', 'missing', 'private'],
          appearance: 'blur',
          coverage: 'full',
          reveal: 'never',
        },
      ],
      activeProfileId: 'missing',
    });

    expect(state.lenses).toEqual([
      {
        id: ENGLISH_PROFANITY_LENS_ID,
        name: 'Profanity',
        kind: 'english-profanity',
        terms: [],
      },
      {
        id: 'private',
        name: 'Client privacy',
        kind: 'terms',
        terms: ['Alice', 'Project Velvet'],
      },
    ]);
    expect(activeProfile(state)).toEqual({
      id: 'presentation',
      name: 'Presentation',
      lensIds: ['private'],
      appearance: 'blur',
      coverage: 'full',
      reveal: 'never',
    });
    expect(profileTerms(state)).toEqual(['Alice', 'Project Velvet']);
    expect(profileUsesEnglishProfanity(state)).toBe(false);
  });

  it('shares one matcher budget across custom lenses', () => {
    const firstTerms = Array.from(
      { length: MAX_CUSTOM_TERMS - 1 },
      (_, index) => `first-${index}`
    );
    const state = normalizeLocalState({
      lenses: [
        { id: 'first', name: 'First', kind: 'terms', terms: firstTerms },
        {
          id: 'second',
          name: 'Second',
          kind: 'terms',
          terms: ['kept', 'dropped'],
        },
      ],
      profiles: [
        {
          id: 'profile',
          name: 'Profile',
          lensIds: ['first', 'second'],
          appearance: 'scrawl',
          coverage: 'middle',
          reveal: 'hover',
        },
      ],
      activeProfileId: 'profile',
    });

    const second = state.lenses.find(lens => lens.id === 'second');
    expect(second?.terms).toEqual(['kept']);
  });

  it('switches profiles and updates only the active profile', () => {
    const initial = createDefaultLocalState();
    const second = {
      id: 'profile:presentation',
      name: 'Presentation',
      lensIds: [],
      appearance: 'bar' as const,
      coverage: 'full' as const,
      reveal: 'never' as const,
    };
    const withSecond = {
      ...initial,
      profiles: [...initial.profiles, second],
    };
    const switched = setActiveProfile(withSecond, second.id);
    const updated = updateActiveProfile(switched, { reveal: 'click' });

    expect(activeProfile(updated).name).toBe('Presentation');
    expect(activeProfile(updated).reveal).toBe('click');
    expect(updated.profiles[0]?.reveal).toBe(initial.profiles[0]?.reveal);
  });

  it('maps the vowel setting to the English coverage helper', () => {
    expect(typeof coverageSelector('vowel')).toBe('function');
    expect(coverageSelector('middle')).toBe('middle');
  });

  it('generates symbol masks by grapheme count without rewriting source text', () => {
    expect(maskFor('fuck', 'asterisk')).toBe('****');
    expect(maskFor('abcdef', 'grawlix')).toBe('@#$%&!');
    expect(maskFor('e\u0301❤️👍🏽🇺🇸👨‍👩‍👧‍👦', 'asterisk')).toBe('*****');
    expect(maskFor('e\u0301❤️👍🏽🇺🇸👨‍👩‍👧‍👦', 'grawlix')).toBe('@#$%&');
    expect(maskFor('fuck', 'bar')).toBe('');
  });
});
