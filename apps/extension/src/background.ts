import { revealTabFor, syncContentScriptRegistration } from './access';
import {
  ADD_SELECTION_MENU_ID,
  TEMPORARY_REVEAL_COMMAND,
  customTermFromSelection,
} from './actions';
import { activeProfile } from './config';
import { commitExtensionMutation } from './settings-mutations';
import { loadExtensionState, migrateSiteOverridesToLocal } from './storage';

const QUICK_TERMS_LENS_ID = 'lens:quick-terms';

async function refreshBrowserState() {
  await migrateSiteOverridesToLocal();
  await syncContentScriptRegistration();
}

function installContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ADD_SELECTION_MENU_ID,
      title: 'Add “%s” to Scrawlix',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
}

async function addSelectionTerm(term: string) {
  const { localState } = await loadExtensionState();
  const profile = activeProfile(localState);
  const activeLensIds = new Set(profile.lensIds);
  const target = localState.lenses.find(
    lens => lens.kind === 'terms' && activeLensIds.has(lens.id)
  );

  let lensId = target?.id;
  if (!lensId) {
    const quickLens = localState.lenses.find(
      lens => lens.id === QUICK_TERMS_LENS_ID && lens.kind === 'terms'
    );
    lensId = quickLens?.id ?? QUICK_TERMS_LENS_ID;

    if (!quickLens) {
      await commitExtensionMutation({
        type: 'add-lens',
        lensId,
        name: 'Quick terms',
        enableForProfileId: profile.id,
      });
    } else {
      await commitExtensionMutation({
        type: 'profile-lens',
        profileId: profile.id,
        lensId,
        enabled: true,
      });
    }
  }

  await commitExtensionMutation({
    type: 'add-lens-terms',
    lensId,
    terms: [term],
  });
}

chrome.runtime.onInstalled.addListener(() => {
  installContextMenu();
  void refreshBrowserState();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshBrowserState();
});

chrome.permissions.onAdded.addListener(() => {
  void syncContentScriptRegistration();
});

chrome.permissions.onRemoved.addListener(() => {
  void syncContentScriptRegistration();
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== TEMPORARY_REVEAL_COMMAND || tab?.id === undefined) return;
  void revealTabFor(tab.id);
});

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== ADD_SELECTION_MENU_ID) return;
  const term = customTermFromSelection(info.selectionText);
  if (!term) return;
  void addSelectionTerm(term);
});

installContextMenu();
void refreshBrowserState();
