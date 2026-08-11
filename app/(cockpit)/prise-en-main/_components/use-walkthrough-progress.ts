"use client";

import { useEffect, useMemo, useState } from "react";
import type { WalkthroughContextCompletion } from "@/lib/memory-completion";
import {
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT,
  emptyWalkthroughState,
  parseWalkthroughState,
  walkthroughCompletedWithContext,
  type WalkthroughPath,
  type WalkthroughScenario,
  type WalkthroughState,
} from "@/lib/onboarding/walkthrough";

const PENDING_MISSION_KEY = "nepteo_walkthrough_pending_v1";

function writeState(next: WalkthroughState): void {
  try {
    window.localStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WALKTHROUGH_UPDATED_EVENT));
  } catch {
    // Le guide reste utilisable si le stockage du navigateur est bloqué.
  }
}

export function useWalkthroughProgress({
  initialPath,
  initialScenario,
  contextCompletion,
}: {
  initialPath?: WalkthroughPath;
  initialScenario?: WalkthroughScenario;
  contextCompletion: WalkthroughContextCompletion;
}) {
  const [state, setState] = useState<WalkthroughState>(() =>
    emptyWalkthroughState(initialPath ?? "free", initialScenario),
  );
  const [skippedContext, setSkippedContext] = useState<string[]>([]);
  const [loadingSkipped, setLoadingSkipped] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored = emptyWalkthroughState();
      try {
        stored = parseWalkthroughState(
          window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY),
        );
      } catch {
        // La progression reste disponible pour la session courante.
      }
      const pathChanged = Boolean(initialPath && initialPath !== stored.path);
      let completed = pathChanged ? [] : stored.completed;
      if (!pathChanged) {
        try {
          const pending = window.sessionStorage.getItem(PENDING_MISSION_KEY);
          if (pending && pending !== "activity" && pending !== "voice") {
            const visited = WALKTHROUGH_MISSIONS.some(
              (mission) => mission.id === pending,
            );
            if (visited) completed = [...completed, pending];
          }
          window.sessionStorage.removeItem(PENDING_MISSION_KEY);
        } catch {
          // La visite ne sera simplement pas mémorisée.
        }
      }
      completed = walkthroughCompletedWithContext(completed, contextCompletion);
      const next: WalkthroughState = {
        ...stored,
        path: initialPath ?? stored.path,
        scenario:
          initialScenario ?? (pathChanged ? undefined : stored.scenario),
        completed,
        updatedAt: new Date().toISOString(),
      };
      setState(next);
      writeState(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [contextCompletion, initialPath, initialScenario]);

  const currentMission = useMemo(
    () =>
      WALKTHROUGH_MISSIONS.find(
        (mission) =>
          !state.completed.includes(mission.id) &&
          !skippedContext.includes(mission.id),
      ),
    [skippedContext, state.completed],
  );

  function complete(id: string) {
    setState((current) => {
      const next = {
        ...current,
        completed: [...new Set([...current.completed, id])],
        updatedAt: new Date().toISOString(),
      };
      writeState(next);
      return next;
    });
  }

  function launch(showLoadingMission: boolean) {
    if (!currentMission || showLoadingMission) return;
    try {
      window.sessionStorage.setItem(PENDING_MISSION_KEY, currentMission.id);
    } catch {
      // La navigation reste possible sans stockage de session.
    }
  }

  function skip(showLoadingMission: boolean) {
    if (showLoadingMission) return setLoadingSkipped(true);
    if (!currentMission) return;
    if (currentMission.id === "activity" || currentMission.id === "voice") {
      setSkippedContext((current) => [...current, currentMission.id]);
    } else {
      complete(currentMission.id);
    }
  }

  function reset() {
    if (!window.confirm("Réinitialiser la progression locale du guide ?")) return;
    const next = emptyWalkthroughState(state.path, state.scenario);
    next.completed = walkthroughCompletedWithContext([], contextCompletion);
    next.updatedAt = new Date().toISOString();
    setSkippedContext([]);
    setLoadingSkipped(false);
    try {
      window.sessionStorage.removeItem(PENDING_MISSION_KEY);
    } catch {
      // Le reste de la progression locale est tout de même réinitialisé.
    }
    setState(next);
    writeState(next);
  }

  return { state, currentMission, loadingSkipped, launch, skip, reset };
}
