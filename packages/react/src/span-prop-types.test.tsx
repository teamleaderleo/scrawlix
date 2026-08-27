import type { CensoredTextProps } from './index';

const rules = [{ id: 'fuck', pattern: /fuck/giu }] as const;

const safeMetadata: CensoredTextProps = {
  text: 'safe',
  rules,
  id: 'copy',
  lang: 'en',
  dir: 'auto',
  'aria-describedby': 'hint',
  'data-testid': 'copy',
};
void safeMetadata;

const reservedDataNamespace: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error Scrawlix owns its entire data namespace.
  'data-scrawlix-reveal': 'click',
};
void reservedDataNamespace;

const reservedLabel: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error Scrawlix owns its accessible source labeling.
  'aria-label': 'replacement',
};
void reservedLabel;

const reservedEditable: CensoredTextProps = {
  text: 'safe',
  rules,
  // @ts-expect-error Scrawlix owns generated children and cannot be an editing host.
  contentEditable: true,
};
void reservedEditable;
