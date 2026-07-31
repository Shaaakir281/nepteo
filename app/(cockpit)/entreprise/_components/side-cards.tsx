import Link from "next/link";
import { Card } from "@/components/ui/card";
import { icons } from "@/components/icons";

export function DocumentsCard({
  canEdit,
  blockedByDemo,
  researchEnabled,
}: {
  canEdit: boolean;
  blockedByDemo: boolean;
  researchEnabled: boolean;
}) {
  return (
    <Card title="Documents & sources" sub="Ce que Nepteo a lu">
      <div className="px-[22px] py-6">
        <p className="text-[13px] font-medium text-ink">
          Faites découvrir votre entreprise à Nepteo
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Donnez l&apos;adresse de votre site : Nepteo le lit, consulte des
          sources publiques et vous propose une fiche à corriger avant
          enregistrement.
        </p>
        {blockedByDemo ? (
          <div className="mt-4 rounded-[10px] bg-amber-tint px-3.5 py-2.5 text-[12px] leading-relaxed text-body">
            <p>
              L&apos;analyse de site est désactivée tant que le scénario Nepteo
              est actif.
            </p>
            <Link
              href="/entreprise?onglet=connecteurs"
              className="mt-1.5 inline-block font-semibold text-violet hover:underline"
            >
              Retirer le scénario dans Connecteurs →
            </Link>
          </div>
        ) : researchEnabled && canEdit ? (
          <Link
            href="/onboarding/identite"
            className="mt-4 flex items-center justify-center gap-2 rounded-[10px] bg-violet px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep"
          >
            {icons.search}
            Analyser mon site
          </Link>
        ) : !researchEnabled ? (
          <p className="mt-4 rounded-[10px] bg-tint-soft px-3.5 py-2.5 text-[12px] text-muted">
            La recherche web n&apos;est pas configurée sur ce compte.
          </p>
        ) : null}
        <span className="mt-4 flex cursor-default items-center justify-center gap-2 rounded-[13px] border-[1.5px] border-dashed border-line px-4 py-[11px] text-[13px] font-semibold text-faint">
          {icons.plus}
          Ajouter un document — bientôt
        </span>
      </div>
    </Card>
  );
}

export function LearningsCard() {
  return (
    <Card title="Ce que Nepteo a appris" sub="Vous gardez le dernier mot">
      <div className="px-[22px] py-6">
        <p className="text-[13px] font-medium text-ink">
          Les premières observations arriveront avec vos données
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Dès qu&apos;un connecteur sera branché, Nepteo notera ici ce
          qu&apos;il observe — délais de signature, meilleurs créneaux,
          segments qui répondent le mieux…
        </p>
        <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-tint-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-body">
          <span className="mt-0.5 flex-none">{icons.info}</span>
          <span>
            Ces observations resteront des <b>hypothèses</b> tant que vous ne
            les aurez pas confirmées. Confirmées, elles renforcent les
            recommandations ; corrigées, Nepteo apprend de votre retour.
          </span>
        </div>
      </div>
    </Card>
  );
}
