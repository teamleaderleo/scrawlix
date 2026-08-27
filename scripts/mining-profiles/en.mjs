import { createScrawlix } from '../../packages/core/dist/index.js';
import {
  englishObfuscatedStrongProfanityRules,
  englishStrongProfanityRules,
} from '../../packages/en/dist/index.js';

export const miningAdapter = {
  id: 'en-strong-profanity',
  profiles: {
    canonical: createScrawlix({ rules: englishStrongProfanityRules }),
    obfuscated: createScrawlix({ rules: englishObfuscatedStrongProfanityRules }),
  },
};
