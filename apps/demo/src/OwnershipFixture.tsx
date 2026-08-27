import { useState } from 'react';

export function OwnershipFixture() {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [textMounted, setTextMounted] = useState(true);

  return (
    <main data-scrawlix-ownership-fixture>
      <button id="react-increment" type="button" onClick={() => setCount(value => value + 1)}>
        increment
      </button>
      <button id="react-toggle-text" type="button" onClick={() => setTextMounted(value => !value)}>
        toggle text
      </button>
      <button id="react-toggle" type="button" onClick={() => setMounted(value => !value)}>
        toggle
      </button>
      {mounted ? (
        <p id="react-owned">
          <span>state: </span>
          {textMounted ? `fuck ${count}` : null}
        </p>
      ) : (
        <p id="react-unmounted">unmounted</p>
      )}
    </main>
  );
}
