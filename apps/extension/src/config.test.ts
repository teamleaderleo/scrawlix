import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  ENGLISH_PROFANITY_LENS_ID,
  activeProfile,
  coverageSelector,
  createDefaultLocalState,
  effectiveEnabled,
  maskFor,
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
  it('normalizes invalid stored values to safe defaults', () => {
    expect(
      normalizeSettings({
        enabled: 'yes',
        appearance: 'paint',
        coverage: 'random',
        reveal: 'sometimes',
        siteOverrides: {
          'Example.COM': 'off',
          'bad.example': 'inherit',
          '': 'on',
        },
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      siteOverrides: { 'example.com': 'off' },
    });
  });

  it('lets explicit site modes override the global switch', () => {
    const disabled = { ...DEFAULT_SETTINGS, enabled: false };
    const forcedOn = setSiteMode(disabled, 'example.com', 'on');
    expect(siteModeFor(forcedOn, 'example.com')).toBe('on');
    expect(effectiveEnabled(forcedOn, 'example.com')).toBe(true);

    const forcedOff = setSiteMode(DEFAULT_SETTINGS, 'example.com', 'off');
    expect(effectiveEnabled(forcedOff, 'example.com')).toBe(false);
  });

  it('removes a site override when mode returns to inherit', () => {
    const withOverride = setSiteMode(DEFAULT_SETTINGS, 'Example.COM', 'off');
    const inherited = setSiteMode(withOverride, 'example.com', 'inherit');

    expect(inherited.siteOverrides).toEqual({});
    expect(siteModeFor(inherited, 'example.com')).toBe('inherit');
  });

  it('deduplicates and trims custom words case-insensitively', () => {
    expect(
      normalizeCustomWords([' Velvet ', 'velvet', '', 42, 'Mothbit', 'MOTHBIT'])
    ).toEqual(['Velvet', 'Mothbit']);
  });

  it('migrates the old treatment and custom-word bucket into an Everyday profile', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      appearance: 'bar' as const,
      coverage: 'full' as const,
      reveal: 'click' as const,
    };
    const state = createDefaultLocalState(settings, [' Project Velvet ', 'velvet']);
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

  it('normalizes local lenses and profiles while dropping missing lens references', () => {
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
