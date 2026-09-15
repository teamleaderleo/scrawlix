import {
  activeProfile,
  mergeLensTerms,
  normalizeLocalState,
  setActiveProfile,
  setSiteMode,
  type CustomWordMergeResult,
  type ExtensionAppearance,
  type ExtensionCoverage,
  type ExtensionLens,
  type ExtensionLocalState,
  type ExtensionProfile,
  type ExtensionReveal,
  type SiteMode,
  type SyncSettings,
} from './config';
import {
  loadExtensionState,
  saveCompactSettings,
  saveLocalState,
  saveSiteOverrides,
} from './storage';

export type ExtensionState = {
  settings: SyncSettings;
  localState: ExtensionLocalState;
};

export type ExtensionMutation =
  | { type: 'paused'; value: boolean }
  | { type: 'enabled'; value: boolean }
  | { type: 'site-mode'; hostname: string; mode: SiteMode }
  | { type: 'active-profile'; profileId: string }
  | {
      type: 'profile-patch';
      profileId: string;
      patch: Partial<
        Pick<
          ExtensionProfile,
          'name' | 'appearance' | 'coverage' | 'reveal'
        >
      >;
    }
  | {
      type: 'profile-lens';
      profileId: string;
      lensId: string;
      enabled: boolean;
    }
  | {
      type: 'add-profile';
      profileId: string;
      name: string;
      cloneFromProfileId?: string;
    }
  | { type: 'remove-profile'; profileId: string }
  | {
      type: 'add-lens';
      lensId: string;
      name: string;
      enableForProfileId?: string;
    }
  | { type: 'lens-name'; lensId: string; name: string }
  | { type: 'add-lens-terms'; lensId: string; terms: string[] }
  | { type: 'remove-lens-term'; lensId: string; term: string }
  | { type: 'remove-lens'; lensId: string };

export type MutationCommit = {
  state: ExtensionState;
  termResult?: CustomWordMergeResult;
};

const EXTENSION_STATE_WRITE_LOCK = 'scrawlix-extension-state-write';

function patchProfile(
  localState: ExtensionLocalState,
  profileId: string,
  patch: Partial<
    Pick<ExtensionProfile, 'name' | 'appearance' | 'coverage' | 'reveal'>
  >
) {
  return {
    ...localState,
    profiles: localState.profiles.map(profile =>
      profile.id === profileId ? { ...profile, ...patch } : profile
    ),
  };
}

function patchLens(
  localState: ExtensionLocalState,
  lensId: string,
  patch: Partial<Pick<ExtensionLens, 'name' | 'terms'>>
) {
  return {
    ...localState,
    lenses: localState.lenses.map(lens =>
      lens.id === lensId && lens.kind === 'terms'
        ? { ...lens, ...patch }
        : lens
    ),
  };
}

function applyLocalMutation(
  localState: ExtensionLocalState,
  mutation: Exclude<
    ExtensionMutation,
    { type: 'paused' } | { type: 'enabled' } | { type: 'site-mode' }
  >
): { localState: ExtensionLocalState; termResult?: CustomWordMergeResult } {
  switch (mutation.type) {
    case 'active-profile':
      return {
        localState: setActiveProfile(localState, mutation.profileId),
      };

    case 'profile-patch':
      return {
        localState: patchProfile(localState, mutation.profileId, mutation.patch),
      };

    case 'profile-lens': {
      const profile = localState.profiles.find(
        candidate => candidate.id === mutation.profileId
      );
      if (!profile) return { localState };

      const lensExists = localState.lenses.some(
        candidate => candidate.id === mutation.lensId
      );
      if (!lensExists) return { localState };

      const lensIds = new Set(profile.lensIds);
      if (mutation.enabled) lensIds.add(mutation.lensId);
      else lensIds.delete(mutation.lensId);

      return {
        localState: {
          ...localState,
          profiles: localState.profiles.map(candidate =>
            candidate.id === profile.id
              ? { ...candidate, lensIds: Array.from(lensIds) }
              : candidate
          ),
        },
      };
    }

    case 'add-profile': {
      if (
        localState.profiles.some(
          candidate => candidate.id === mutation.profileId
        )
      ) {
        return { localState };
      }

      const source =
        localState.profiles.find(
          candidate => candidate.id === mutation.cloneFromProfileId
        ) ?? activeProfile(localState);
      const profile: ExtensionProfile = {
        ...source,
        id: mutation.profileId,
        name: mutation.name.trim() || `Profile ${localState.profiles.length + 1}`,
        lensIds: [...source.lensIds],
      };
      return {
        localState: {
          ...localState,
          profiles: [...localState.profiles, profile],
          activeProfileId: profile.id,
        },
      };
    }

    case 'remove-profile': {
      if (localState.profiles.length <= 1) return { localState };
      const profiles = localState.profiles.filter(
        profile => profile.id !== mutation.profileId
      );
      if (profiles.length === localState.profiles.length) return { localState };
      const activeProfileId =
        localState.activeProfileId === mutation.profileId
          ? profiles[0]!.id
          : localState.activeProfileId;
      return {
        localState: { ...localState, profiles, activeProfileId },
      };
    }

    case 'add-lens': {
      if (localState.lenses.some(lens => lens.id === mutation.lensId)) {
        return { localState };
      }

      const lens: ExtensionLens = {
        id: mutation.lensId,
        name:
          mutation.name.trim() ||
          `Lens ${
            localState.lenses.filter(candidate => candidate.kind === 'terms')
              .length + 1
          }`,
        kind: 'terms',
        terms: [],
      };
      let next: ExtensionLocalState = {
        ...localState,
        lenses: [...localState.lenses, lens],
      };

      if (mutation.enableForProfileId) {
        const profile = next.profiles.find(
          candidate => candidate.id === mutation.enableForProfileId
        );
        if (profile) {
          next = {
            ...next,
            profiles: next.profiles.map(candidate =>
              candidate.id === profile.id
                ? {
                    ...candidate,
                    lensIds: [...new Set([...candidate.lensIds, lens.id])],
                  }
                : candidate
            ),
          };
        }
      }
      return { localState: next };
    }

    case 'lens-name':
      return {
        localState: patchLens(localState, mutation.lensId, {
          name: mutation.name,
        }),
      };

    case 'add-lens-terms': {
      const termResult = mergeLensTerms(
        localState,
        mutation.lensId,
        mutation.terms
      );
      return {
        localState: patchLens(localState, mutation.lensId, {
          terms: termResult.words,
        }),
        termResult,
      };
    }

    case 'remove-lens-term': {
      const key = mutation.term.toLocaleLowerCase();
      const lens = localState.lenses.find(
        candidate =>
          candidate.id === mutation.lensId && candidate.kind === 'terms'
      );
      if (!lens || lens.kind !== 'terms') return { localState };
      return {
        localState: patchLens(localState, mutation.lensId, {
          terms: lens.terms.filter(
            term => term.toLocaleLowerCase() !== key
          ),
        }),
      };
    }

    case 'remove-lens': {
      const lens = localState.lenses.find(
        candidate =>
          candidate.id === mutation.lensId && candidate.kind === 'terms'
      );
      if (!lens) return { localState };

      return {
        localState: {
          ...localState,
          lenses: localState.lenses.filter(
            candidate => candidate.id !== mutation.lensId
          ),
          profiles: localState.profiles.map(profile => ({
            ...profile,
            lensIds: profile.lensIds.filter(id => id !== mutation.lensId),
          })),
        },
      };
    }
  }
}

export function applyExtensionMutation(
  state: ExtensionState,
  mutation: ExtensionMutation
): MutationCommit {
  if (mutation.type === 'paused') {
    return {
      state: {
        ...state,
        settings: { ...state.settings, paused: mutation.value },
      },
    };
  }

  if (mutation.type === 'enabled') {
    return {
      state: {
        ...state,
        settings: { ...state.settings, enabled: mutation.value },
      },
    };
  }

  if (mutation.type === 'site-mode') {
    return {
      state: {
        ...state,
        settings: setSiteMode(
          state.settings,
          mutation.hostname,
          mutation.mode
        ),
      },
    };
  }

  const local = applyLocalMutation(state.localState, mutation);
  return {
    state: {
      ...state,
      localState: normalizeLocalState(local.localState, state.settings),
    },
    ...(local.termResult ? { termResult: local.termResult } : {}),
  };
}

async function commitUnlocked(
  mutation: ExtensionMutation
): Promise<MutationCommit> {
  const current = await loadExtensionState();
  const committed = applyExtensionMutation(current, mutation);

  if (mutation.type === 'paused' || mutation.type === 'enabled') {
    await saveCompactSettings(committed.state.settings);
  } else if (mutation.type === 'site-mode') {
    await saveSiteOverrides(committed.state.settings.siteOverrides);
  } else {
    await saveLocalState(committed.state.localState);
  }

  return committed;
}

export async function commitExtensionMutation(
  mutation: ExtensionMutation
): Promise<MutationCommit> {
  const locks = navigator.locks;
  if (!locks) return commitUnlocked(mutation);
  return locks.request(EXTENSION_STATE_WRITE_LOCK, () =>
    commitUnlocked(mutation)
  );
}

export type ProfileTreatmentPatch = Partial<{
  appearance: ExtensionAppearance;
  coverage: ExtensionCoverage;
  reveal: ExtensionReveal;
}>;
