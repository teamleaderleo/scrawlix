const SAFE_TOKEN = /^[a-z0-9-]+$/i;

export function scopedPresentationCss(token: string) {
  if (!SAFE_TOKEN.test(token)) {
    throw new Error('Scrawlix presentation token contains unsupported characters.');
  }

  const root = `[data-scrawlix-extension-owned="${token}"]`;
  return `${root} {
  --scrawlix-soft-ink: color-mix(in srgb, currentColor 24%, transparent);
  --scrawlix-fuzzy-ink: color-mix(in srgb, currentColor 58%, transparent);
}

${root} [data-scrawlix-cover] {
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  position: relative;
  transition: filter 140ms ease, background 140ms ease, text-shadow 140ms ease, -webkit-text-fill-color 140ms ease;
}

${root}[data-scrawlix-appearance='scrawl'] [data-scrawlix-cover] {
  -webkit-text-fill-color: transparent;
  background: repeating-linear-gradient(-13deg, var(--scrawlix-soft-ink) 0 0.08em, transparent 0.08em 0.18em);
  border-radius: 0.18em;
  padding-inline: 0.04em;
  text-shadow: 0 0 0.34em var(--scrawlix-fuzzy-ink);
}

${root}[data-scrawlix-appearance='bar'] [data-scrawlix-cover] {
  -webkit-text-fill-color: transparent;
  background: linear-gradient(currentColor, currentColor) center / 100% 0.72em no-repeat;
  border-radius: 0.06em;
}

${root}[data-scrawlix-appearance='blur'] [data-scrawlix-cover] {
  filter: blur(0.17em);
  user-select: none;
}

${root} [data-scrawlix-cover][data-scrawlix-mask] {
  display: inline-block;
  position: relative;
  -webkit-text-fill-color: transparent;
}

${root} [data-scrawlix-cover][data-scrawlix-mask]::after {
  content: attr(data-scrawlix-mask);
  position: absolute;
  inset: 0;
  color: currentColor;
  -webkit-text-fill-color: currentColor;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
  font-weight: 700;
  letter-spacing: -0.04em;
  pointer-events: none;
  white-space: pre;
}

${root}[data-scrawlix-reveal='hover']:hover [data-scrawlix-cover],
${root}[data-scrawlix-reveal='click'][data-scrawlix-revealed='true'] [data-scrawlix-cover],
html[data-scrawlix-page-revealed='true'] ${root} [data-scrawlix-cover] {
  -webkit-text-fill-color: currentColor;
  background: none;
  filter: none;
  padding-inline: 0;
  text-shadow: none;
  user-select: text;
}

${root}[data-scrawlix-reveal='hover']:hover [data-scrawlix-cover][data-scrawlix-mask]::after,
${root}[data-scrawlix-reveal='click'][data-scrawlix-revealed='true'] [data-scrawlix-cover][data-scrawlix-mask]::after,
html[data-scrawlix-page-revealed='true'] ${root} [data-scrawlix-cover][data-scrawlix-mask]::after {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  ${root} [data-scrawlix-cover] {
    transition: none;
  }
}
`;
}
