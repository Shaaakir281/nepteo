import { isRelanceKind } from "@/lib/draft-template";
import { ActionDraftEditor } from "./action-draft-editor";
import { ActionValueFeedback } from "./action-value-feedback";
import { CampaignCreativeDetails } from "./campaign-details";
import { CampaignProposalDetails } from "./campaign-proposal-details";
import { CampaignValidationEvidence } from "./campaign-validation-evidence";
import { ProspectDrafts } from "./prospect-drafts";
import type { QueueAction } from "./validation-drawer";

function SupportDetails({
  action,
  children,
}: {
  action: QueueAction;
  children?: React.ReactNode;
}) {
  const sourceCount = action.data_sources.length;
  return (
    <details className="mt-3 rounded-[11px] border border-line-soft bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[12px] font-semibold text-ink">
        <span>Sur quoi Nepteo s&apos;appuie</span>
        <span className="text-[10.5px] text-faint">
          {sourceCount} source{sourceCount > 1 ? "s" : ""}
        </span>
      </summary>
      <div className="border-t border-line-soft px-3 pb-3 pt-2.5 text-[12px] leading-relaxed text-body">
        {action.finding && <p><b className="text-ink">Constat.</b> {action.finding}</p>}
        {action.rationale && <p className="mt-2"><b className="text-ink">Raison.</b> {action.rationale}</p>}
        {sourceCount > 0 && (
          <p className="mt-2"><b className="text-ink">Données.</b> {action.data_sources.join(" · ")}</p>
        )}
        {children}
        <p className="mt-3 text-[10.5px] text-faint">
          Contexte société uniquement. Une corrélation n&apos;est pas une cause.
        </p>
      </div>
    </details>
  );
}

function RelaunchContent({ action, canEdit }: { action: QueueAction; canEdit: boolean }) {
  return (
    <>
      <ActionDraftEditor id={action.id} canEdit={canEdit} />
      <ProspectDrafts actionId={action.id} canEdit={canEdit} />
      <SupportDetails action={action} />
      {canEdit && (
        <ActionValueFeedback actionId={action.id} mode="evaluation" includeDraft />
      )}
    </>
  );
}

function CampaignContent({ action, canEdit }: { action: QueueAction; canEdit: boolean }) {
  const hasDetails = Boolean(action.payload || action.creatives?.length);
  return (
    <>
      <SupportDetails action={action}>
        <CampaignValidationEvidence
          payload={action.payload}
          dataSources={action.data_sources}
          expectedImpact={action.expected_impact}
        />
      </SupportDetails>
      {hasDetails && (
        <details className="mt-3 rounded-[11px] border border-line-soft bg-white">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[12px] font-semibold text-ink">
            Détail de la proposition
          </summary>
          <div className="border-t border-line-soft px-3 pb-3">
            <CampaignProposalDetails payload={action.payload} />
            {(action.creatives?.length ?? 0) > 0 && (
              <CampaignCreativeDetails actionId={action.id} creatives={action.creatives ?? []} />
            )}
          </div>
        </details>
      )}
      {canEdit && <ActionValueFeedback actionId={action.id} mode="evaluation" />}
    </>
  );
}

export function ValidationActionContent({
  action,
  canEdit,
}: {
  action: QueueAction;
  canEdit: boolean;
}) {
  if (isRelanceKind(action.kind)) {
    return <RelaunchContent action={action} canEdit={canEdit} />;
  }
  if (action.kind === "launch_campaign") {
    return <CampaignContent action={action} canEdit={canEdit} />;
  }
  return (
    <>
      <SupportDetails action={action} />
      {canEdit && <ActionValueFeedback actionId={action.id} mode="evaluation" />}
    </>
  );
}
