import { effectiveEnabled, type SyncSettings } from './config';

export function canReuseSemanticSession(
  active: SyncSettings,
  next: SyncSettings,
  hostname: string
) {
  return (
    active.coverage === next.coverage &&
    effectiveEnabled(active, hostname) &&
    effectiveEnabled(next, hostname)
  );
}

export function presentationSettingsChanged(
  active: SyncSettings,
  next: SyncSettings
) {
  return active.appearance !== next.appearance || active.reveal !== next.reveal;
}
