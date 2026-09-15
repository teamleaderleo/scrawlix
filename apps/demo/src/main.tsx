import React from 'react';
import ReactDOM from 'react-dom/client';
import '@scrawlix/react/styles.css';
import { App } from './App';
import {
  HYDRATION_FIXTURE_HTML,
  HydrationFixture,
} from './HydrationFixture';
import { OwnershipFixture } from './OwnershipFixture';
import './styles.css';
import './poetry.css';
import './spoilers.css';
import './privacy.css';

const params = new URLSearchParams(window.location.search);
const fixtureMode = params.has('ownership-fixture');
const hydrationFixtureMode = params.has('hydration-fixture');
const root = document.getElementById('root')!;

if (hydrationFixtureMode) {
  root.innerHTML = HYDRATION_FIXTURE_HTML;
  (window as Window & { __scrawlixHydrated?: boolean }).__scrawlixHydrated =
    false;

  window.setTimeout(() => {
    ReactDOM.hydrateRoot(
      root,
      <React.StrictMode>
        <HydrationFixture />
      </React.StrictMode>
    );
  }, 1_000);
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {fixtureMode ? <OwnershipFixture /> : <App />}
    </React.StrictMode>
  );
}
