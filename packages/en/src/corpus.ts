export type EnglishCorpusMatch = {
  ruleId: string;
  text: string;
  targetText: string;
};

export type EnglishCorpusCase = {
  id: string;
  text: string;
  matches: readonly EnglishCorpusMatch[];
};

/**
 * Small, reviewable regression corpus for the bundled English profanity rules.
 * Add a case whenever a bug report or rule change teaches us something durable.
 */
export const englishProfanityCorpus: readonly EnglishCorpusCase[] = [
  {
    id: 'fuck-base',
    text: 'fuck',
    matches: [{ ruleId: 'fuck', text: 'fuck', targetText: 'fuck' }],
  },
  {
    id: 'fuck-uppercase-inflection',
    text: 'FUCKING',
    matches: [{ ruleId: 'fuck', text: 'FUCKING', targetText: 'FUCK' }],
  },
  {
    id: 'fuck-mother-compound',
    text: 'motherfucker',
    matches: [
      { ruleId: 'fuck', text: 'motherfucker', targetText: 'fuck' },
    ],
  },
  {
    id: 'fuck-punctuation',
    text: 'well, fuck!',
    matches: [{ ruleId: 'fuck', text: 'fuck', targetText: 'fuck' }],
  },
  {
    id: 'shit-bull-compound',
    text: 'bullshit',
    matches: [{ ruleId: 'shit', text: 'bullshit', targetText: 'shit' }],
  },
  {
    id: 'shit-inflection',
    text: 'shitty',
    matches: [{ ruleId: 'shit', text: 'shitty', targetText: 'shit' }],
  },
  {
    id: 'bitch-plural',
    text: 'bitches',
    matches: [{ ruleId: 'bitch', text: 'bitches', targetText: 'bitch' }],
  },
  {
    id: 'asshole-plural',
    text: 'assholes',
    matches: [
      { ruleId: 'asshole', text: 'assholes', targetText: 'asshole' },
    ],
  },
  {
    id: 'cunt-plural',
    text: 'cunts',
    matches: [{ ruleId: 'cunt', text: 'cunts', targetText: 'cunt' }],
  },
  {
    id: 'multiple-rules',
    text: 'fuck this shit',
    matches: [
      { ruleId: 'fuck', text: 'fuck', targetText: 'fuck' },
      { ruleId: 'shit', text: 'shit', targetText: 'shit' },
    ],
  },
] as const;

/** Cases that contain suspicious substrings but should remain untouched. */
export const englishCleanCorpus: readonly EnglishCorpusCase[] = [
  { id: 'scunthorpe', text: 'Scunthorpe', matches: [] },
  { id: 'shitake', text: 'shitake mushrooms', matches: [] },
  { id: 'classhole', text: 'classhole', matches: [] },
  { id: 'motherfuckerish', text: 'motherfuckerish', matches: [] },
  { id: 'ordinary-prose', text: 'a perfectly ordinary sentence', matches: [] },
] as const;
