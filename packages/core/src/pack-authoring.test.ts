import { describe, expect, it } from 'vitest';
import type { CensorRule } from './index';
import {
  defineRulePack,
  type RulePackManifest,
} from './pack-authoring';

const rules: readonly CensorRule[] = [{ id: 'example', pattern: /example/gu }];

function manifest(
  overrides: Partial<RulePackManifest> = {}
): RulePackManifest {
  return {
    schemaVersion: 1,
    id: 'xx-example',
    version: '1.2.3',
    name: 'Example multilingual pack',
    locales: ['tr-tr', 'ja-jp'],
    dialects: ['en-us'],
    regions: ['TR', 'JP'],
    registers: ['informal'],
    categories: ['profanity'],
    severity: ['strong'],
    review: {
      status: 'reviewed',
      nativeReview: 'partial',
      reviewedAt: '2026-09-15',
    },
    corpus: {
      schemaVersion: 1,
      entrypoint: '@example/pack/corpus',
      profiles: ['canonical', 'aggressive'],
    },
    provenance: [
      {
        id: 'source-a',
        label: 'Reviewed source A',
        license: 'CC-BY-4.0',
      },
    ],
    license: { id: 'MIT' },
    limitations: ['No automatic morphology generation.'],
    ...overrides,
  };
}

describe('pack authoring manifests', () => {
  it('normalizes locale tags and derives CensorRulePack locale metadata', () => {
    const pack = defineRulePack(manifest(), rules);

    expect(pack.id).toBe('xx-example');
    expect(pack.locale).toEqual(['tr-TR', 'ja-JP']);
    expect(pack.rules).toBe(rules);
    expect(pack.manifest.locales).toEqual(['tr-TR', 'ja-JP']);
    expect(pack.manifest.dialects).toEqual(['en-US']);
    expect(pack.manifest.corpus).toEqual({
      schemaVersion: 1,
      entrypoint: '@example/pack/corpus',
      profiles: ['canonical', 'aggressive'],
    });
    expect(pack.manifest.review.nativeReview).toBe('partial');
    expect(pack.manifest.provenance?.[0]?.id).toBe('source-a');
  });

  it('uses the single canonical locale string for one-locale packs', () => {
    const pack = defineRulePack(manifest({ locales: ['pt-br'] }), rules);
    expect(pack.locale).toBe('pt-BR');
  });

  it('rejects invalid BCP-47 locale metadata', () => {
    expect(() => defineRulePack(manifest({ locales: ['not_a_locale'] }), rules))
      .toThrow('valid BCP-47 locale tags');
  });

  it('rejects duplicate provenance ids', () => {
    expect(() =>
      defineRulePack(
        manifest({
          provenance: [
            { id: 'same', label: 'First' },
            { id: 'same', label: 'Second' },
          ],
        }),
        rules
      )
    ).toThrow('Duplicate pack provenance id "same"');
  });

  it('rejects authored packs without rules', () => {
    expect(() => defineRulePack(manifest(), [])).toThrow(
      'needs at least one rule'
    );
  });

  it('rejects empty optional metadata lists instead of silently publishing them', () => {
    expect(() =>
      defineRulePack(manifest({ limitations: [' ', ''] }), rules)
    ).toThrow('Pack manifest limitations must contain at least one non-empty string');
  });
});
