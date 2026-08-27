import {
  activeProfile,
  effectiveEnabled,
  profileTerms,
  profileUsesEnglishProfanity,
  type ExtensionLocalState,
  type SyncSettings,
} from './config';

export type ExtensionSessionState = {
  settings: SyncSettings;
  localState: ExtensionLocalState;
};

function canonicalTerms(state: ExtensionLocalState) {
  return profileTerms(state)
    .map(term => term.toLowerCase())
    .sort((left, right) => left.localeCompare(right));
}

function sameTerms(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((term, index) => term === right[index])
  );
}

export function canReuseSemanticSession(
  active: ExtensionSessionState,
  next: ExtensionSessionState,
  hostname: string
) {
  const activeProfileValue = activeProfile(active.localState);
  const nextProfileValue = activeProfile(next.localState);

  return (
    activeProfileValue.coverage === nextProfileValue.coverage &&
    profileUsesEnglishProfanity(active.localState) ===
      profileUsesEnglishProfanity(next.localState) &&
    sameTerms(canonicalTerms(active.localState), canonicalTerms(next.localState)) &&
    effectiveEnabled(active.settings, hostname) &&
    effectiveEnabled(next.settings, hostname)
  );
}

export function presentationSettingsChanged(
  active: ExtensionSessionState,
  next: ExtensionSessionState
) {
  const activeProfileValue = activeProfile(active.localState);
  const nextProfileValue = activeProfile(next.localState);

  return (
    activeProfileValue.appearance !== nextProfileValue.appearance ||
    activeProfileValue.reveal !== nextProfileValue.reveal
  );
}
