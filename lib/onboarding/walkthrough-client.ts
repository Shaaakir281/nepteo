import {
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT,
  parseWalkthroughState,
} from "./walkthrough.ts";

const MISSION_IDS = new Set(WALKTHROUGH_MISSIONS.map((mission) => mission.id));

/** Enregistre une progression issue d'un geste réellement accompli. */
export function completeWalkthroughMissions(ids: readonly string[]): void {
  try {
    const current = parseWalkthroughState(
      window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY),
    );
    const validIds = ids.filter((id) => MISSION_IDS.has(id));
    const completed = [...new Set([...current.completed, ...validIds])];
    if (completed.length === current.completed.length) return;

    window.localStorage.setItem(
      WALKTHROUGH_STORAGE_KEY,
      JSON.stringify({
        ...current,
        completed,
        updatedAt: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(new Event(WALKTHROUGH_UPDATED_EVENT));
  } catch {
    // Le geste métier reste valide si le stockage du guide est bloqué.
  }
}
