import React from 'react';
import ReactDOM from 'react-dom/client';
import '@scrawlix/react/styles.css';
import { App } from './App';
import { OwnershipFixture } from './OwnershipFixture';
import './styles.css';
import './poetry.css';
import './spoilers.css';
import './privacy.css';

const fixtureMode = new URLSearchParams(window.location.search).has(
  'ownership-fixture'
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {fixtureMode ? <OwnershipFixture /> : <App />}
  </React.StrictMode>
);
