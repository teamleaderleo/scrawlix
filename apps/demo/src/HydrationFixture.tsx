import { useEffect, useState } from 'react';

export const HYDRATION_FIXTURE_HTML =
  '<main data-scrawlix-hydration-fixture=""><button id="hydration-increment" type="button">increment</button><p id="hydration-owned"><span>state: </span>fuck 0</p></main>';

export function HydrationFixture() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    (window as Window & { __scrawlixHydrated?: boolean }).__scrawlixHydrated =
      true;
  }, []);

  return (
    <main data-scrawlix-hydration-fixture="">
      <button
        id="hydration-increment"
        type="button"
        onClick={() => setCount(value => value + 1)}
      >
        increment
      </button>
      <p id="hydration-owned">
        <span>state: </span>
        {`fuck ${count}`}
      </p>
    </main>
  );
}
