import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  coverageSelector,
  effectiveEnabled,
  maskFor,
  normalizeCustomWords,
  normalizeSettings,
  setSiteMode,
  siteModeFor,
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
