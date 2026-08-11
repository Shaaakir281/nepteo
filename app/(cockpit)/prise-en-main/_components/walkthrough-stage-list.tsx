import {
  CONNECT_DATA_MISSION,
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STAGES,
  type WalkthroughState,
} from "@/lib/onboarding/walkthrough";

export function WalkthroughStageList({
  state,
  currentStage,
  connectUnlocked,
}: {
  state: WalkthroughState;
  currentStage: number;
  connectUnlocked: boolean;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-[14px] border border-line-soft bg-white shadow-card">
      {WALKTHROUGH_STAGES.map((stage) => {
        const required = WALKTHROUGH_MISSIONS.filter(
          (mission) => mission.stage === stage.id && !mission.optional,
        );
        const complete = required.every((mission) =>
          state.completed.includes(mission.id),
        );
        const current = stage.id === currentStage;

        return (
          <div
            key={stage.id}
            className={`flex items-center gap-3 border-b border-line-soft px-4 py-3 ${
              current ? "bg-tint-soft" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold ${
                complete
                  ? "bg-green text-white"
                  : current
                    ? "bg-violet text-white"
                    : "bg-tint text-faint"
              }`}
            >
              {complete ? "✓" : stage.id + 1}
            </span>
            <span
              className={`text-[12.5px] font-semibold ${
                complete || current ? "text-ink" : "text-faint"
              }`}
            >
              {stage.title}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 px-4 py-3 text-faint">
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold ${
            connectUnlocked ? "bg-green text-white" : "bg-tint"
          }`}
        >
          {connectUnlocked ? "✓" : 6}
        </span>
        <span
          title={CONNECT_DATA_MISSION.goal}
          className="text-[12.5px] font-semibold"
        >
          Connecter vos outils
        </span>
      </div>
    </div>
  );
}
