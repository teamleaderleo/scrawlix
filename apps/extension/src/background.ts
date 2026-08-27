import { revealTabFor, syncContentScriptRegistration } from './access';
import {
  ADD_SELECTION_MENU_ID,
  TEMPORARY_REVEAL_COMMAND,
  customTermFromSelection,
} from './actions';
import {
  loadCustomWords,
  migrateSiteOverridesToLocal,
  saveCustomWords,
} from './storage';

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

  void (async () => {
    const words = await loadCustomWords();
    await saveCustomWords([...words, term]);
  })();
});

void refreshBrowserState();
