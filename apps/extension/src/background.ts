import { syncContentScriptRegistration } from './access';
import { migrateSiteOverridesToLocal } from './storage';

async function refreshBrowserState() {
  await migrateSiteOverridesToLocal();
  await syncContentScriptRegistration();
}

chrome.runtime.onInstalled.addListener(() => {
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

void refreshBrowserState();
