import { describe, expect, it } from 'vitest';
import {
  ALL_HOST_PATTERNS,
  contentScriptMatches,
  originPatternForUrl,
} from './access';

describe('extension browser access helpers', () => {
  it('turns an HTTP(S) page into the narrow origin permission pattern', () => {
    expect(originPatternForUrl('https://Example.com/path?q=1')).toBe('https://example.com/*');
    expect(originPatternForUrl('http://127.0.0.1:4174/fixture.html')).toBe(
      'http://127.0.0.1:4174/*'
    );
    expect(originPatternForUrl('chrome://extensions')).toBeNull();
  });

  it('keeps only HTTP(S) permission origins for dynamic registration', () => {
    expect(
      contentScriptMatches([
        'https://example.com/*',
        'chrome://favicon/*',
        'http://*/*',
        'https://example.com/*',
      ])
    ).toEqual(['http://*/*', 'https://example.com/*']);
  });

  it('declares both web schemes for the explicit all-sites action', () => {
    expect(ALL_HOST_PATTERNS).toEqual(['http://*/*', 'https://*/*']);
  });
});
