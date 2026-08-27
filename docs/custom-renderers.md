# Custom and framework-neutral renderers

`@scrawlix/core` is enough when a framework only needs to turn matched ranges into its own markup. A dedicated adapter earns its keep when it owns interaction, accessibility, lifecycle, restoration, SSR/client-boundary behavior, or a stable framework-specific DOM/CSS contract.

## Install

```sh
npm install @scrawlix/core @scrawlix/en
```

## The renderer contract

`createScrawlix(...).segment(text)` returns ordered `ScrawlixSegment` values:

```ts
type ScrawlixSegment = {
  text: string;
  covered: boolean;
  ruleIds: readonly string[];
};
```

Renderers should preserve these invariants:

- render segments in the returned order
- preserve every `segment.text` exactly
- treat `covered: true` as presentation metadata rather than rewriting the source substring
- keep `ruleIds` available when styling, diagnostics, analytics, or policy UI needs to know which rules contributed
- make `segments.map(segment => segment.text).join('')` equivalent to the original source text

Core deliberately leaves appearance, reveal interaction, accessibility presentation, and DOM ownership to the renderer.

## Plain DOM example

This is the smallest useful adapter: semantic covered spans plus application-owned CSS.

```ts
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const engine = createScrawlix({
  rules: englishStrongProfanityRules,
  coverage: 'middle',
});

export function renderScrawlixText(text: string) {
  const root = document.createElement('span');

  for (const segment of engine.segment(text)) {
    if (!segment.covered) {
      root.append(document.createTextNode(segment.text));
      continue;
    }

    const cover = document.createElement('span');
    cover.setAttribute('data-scrawlix-cover', '');
    cover.setAttribute('data-scrawlix-rules', segment.ruleIds.join(','));
    cover.textContent = segment.text;
    root.append(cover);
  }

  return root;
}
```

```css
[data-scrawlix-cover] {
  background: currentColor;
  color: transparent;
  border-radius: 0.08em;
}
```

This preserves the source substring in the DOM. It is reversible visual presentation. See `privacy-and-output.md` before using a custom renderer for secrets, screenshots, assistive-technology concealment, or sanitized export.

## Vue sketch

Keep the engine outside render work when its rules/options are stable, derive segments from the current text, and let Vue escape text content normally.

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const props = defineProps<{ text: string }>();
const engine = createScrawlix({ rules: englishStrongProfanityRules });
const segments = computed(() => engine.segment(props.text));
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <span
      v-if="segment.covered"
      data-scrawlix-cover
      :data-scrawlix-rules="segment.ruleIds.join(',')"
    >{{ segment.text }}</span>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>
```

## Svelte sketch

```svelte
<script lang="ts">
  import { createScrawlix } from '@scrawlix/core';
  import { englishStrongProfanityRules } from '@scrawlix/en';

  export let text: string;
  const engine = createScrawlix({ rules: englishStrongProfanityRules });
  $: segments = engine.segment(text);
</script>

{#each segments as segment}
  {#if segment.covered}
    <span data-scrawlix-cover data-scrawlix-rules={segment.ruleIds.join(',')}>
      {segment.text}
    </span>
  {:else}
    {segment.text}
  {/if}
{/each}
```

## Solid sketch

```tsx
import { For } from 'solid-js';
import { createScrawlix } from '@scrawlix/core';
import { englishStrongProfanityRules } from '@scrawlix/en';

const engine = createScrawlix({ rules: englishStrongProfanityRules });

export function ScrawlixText(props: { text: string }) {
  const segments = () => engine.segment(props.text);

  return (
    <For each={segments()}>
      {segment =>
        segment.covered ? (
          <span
            data-scrawlix-cover
            data-scrawlix-rules={segment.ruleIds.join(',')}
          >
            {segment.text}
          </span>
        ) : (
          segment.text
        )
      }
    </For>
  );
}
```

These sketches intentionally stop at semantic covered spans. They do not attempt to reproduce `@scrawlix/react` reveal state or accessibility behavior.

## When a dedicated adapter package is justified

A new public framework adapter should solve framework-specific behavior that would otherwise be duplicated across applications. Good reasons include:

- keyboard/pointer reveal interaction with regression tests
- a deliberate accessibility contract
- framework lifecycle cleanup or restoration
- SSR/hydration or server/client-boundary requirements
- framework-native plugin hooks or content-pipeline integration
- a stable appearance DOM/CSS contract that needs coordinated package tests

If the implementation is only `engine.segment(text)` plus a loop that renders text and covered spans, keep it as an application component or recipe. That keeps the public package set small while giving every framework a short adoption path.

## Authoring your own adapter

Start with core rather than copying another adapter's internals. Preserve source text, keep rule selection explicit, and add tests for the framework-specific behavior your adapter introduces. If an adapter becomes reusable enough to propose as a Scrawlix package, document the new responsibility in `AGENTS.md`, add packed-package consumer coverage, and give it its own package README.