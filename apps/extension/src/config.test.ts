import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  coverageSelector,
  effectiveEnabled,
  maskFor,
  normalizeCustomWords,
  normalizeSettings,
  sessionActionFor,
  setSiteMode,
  siteModeFor,
  type ExtensionStateSnapshot,
} from './config';

function state(
  settings = DEFAULT_SETTINGS,
  customWords: readonly string[] = []
): ExtensionStateSnapshot {
  return { settings, customWords };
}

describe('extension settings', () => {
  it('normalizes invalid stored values to safe defaults', () => {
    expect(
      normalizeSettings({
        paused: 'no',
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

  it('migrates stored settings without a paused field as unpaused', () => {
    expect(
      normalizeSettings({
        enabled: false,
        appearance: 'bar',
        coverage: 'full',
        reveal: 'never',
        siteOverrides: { 'example.com': 'on' },
      })
    ).toEqual({
      paused: false,
      enabled: false,
      appearance: 'bar',
      coverage: 'full',
      reveal: 'never',
      siteOverrides: { 'example.com': 'on' },
    });
  });

  it('migrates the retired focus reveal preference to click', () => {
    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        reveal: 'focus',
      }).reveal
    ).toBe('click');
  });

  it('lets explicit site modes override the default site policy', () => {
    const disabled = { ...DEFAULT_SETTINGS, enabled: false };
    const forcedOn = setSiteMode(disabled, 'example.com', 'on');
    expect(siteModeFor(forcedOn, 'example.com')).toBe('on');
    expect(effectiveEnabled(forcedOn, 'example.com')).toBe(true);

    const forcedOff = setSiteMode(DEFAULT_SETTINGS, 'example.com', 'off');
    expect(effectiveEnabled(forcedOff, 'example.com')).toBe(false);
  });

  it('lets the master pause beat a forced-on hostname', () => {
    const forcedOn = setSiteMode(
      { ...DEFAULT_SETTINGS, paused: true, enabled: false },
      'example.com',
      'on'
    );

    expect(effectiveEnabled(forcedOn, 'example.com')).toBe(false);
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

  it('plans the minimum page-session work for settings changes', () => {
    const hostname = 'example.com';
    const base = state();

    expect(sessionActionFor(null, base, hostname, false)).toBe('start');
    expect(sessionActionFor(base, base, hostname, true)).toBe('none');

    expect(
      sessionActionFor(
        base,
        state({ ...DEFAULT_SETTINGS, appearance: 'blur' }),
        hostname,
        true
      )
    ).toBe('decorate');

    expect(
      sessionActionFor(
        base,
        state({ ...DEFAULT_SETTINGS, coverage: 'full' }),
        hostname,
        true
      )
    ).toBe('restart');

    expect(sessionActionFor(base, state(DEFAULT_SETTINGS, ['Mothbit']), hostname, true)).toBe(
      'restart'
    );
  });

  it('does no page work when unrelated policy changes leave this host unchanged', () => {
    const hostname = 'example.com';
    const forcedOn = setSiteMode({ ...DEFAULT_SETTINGS, enabled: false }, hostname, 'on');
    const unrelatedOverride = setSiteMode(forcedOn, 'elsewhere.test', 'off');
    const changedDefault = { ...forcedOn, enabled: true };

    expect(sessionActionFor(state(forcedOn), state(unrelatedOverride), hostname, true)).toBe(
      'none'
    );
    expect(sessionActionFor(state(forcedOn), state(changedDefault), hostname, true)).toBe('none');
  });

  it('stops for pause and starts again after unpausing', () => {
    const hostname = 'example.com';
    const active = state(setSiteMode(DEFAULT_SETTINGS, hostname, 'on'));
    const paused = state({ ...active.settings, paused: true });

    expect(sessionActionFor(active, paused, hostname, true)).toBe('stop');
    expect(sessionActionFor(paused, active, hostname, false)).toBe('start');
  });

  it('maps the vowel setting to the English coverage helper', () => {
    expect(typeof coverageSelector('vowel')).toBe('function');
    expect(coverageSelector('middle')).toBe('middle');
  });

  it('generates symbol masks without rewriting source text', () => {
    expect(maskFor('fuck', 'asterisk')).toBe('****');
    expect(maskFor('abcdef', 'grawlix')).toBe('@#$%&!');
    expect(maskFor('🔥x', 'asterisk')).toBe('**');
    expect(maskFor('fuck', 'bar')).toBe('');
  });
});
