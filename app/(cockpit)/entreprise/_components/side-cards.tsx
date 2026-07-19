import { Card } from "@/components/ui/card";
import { icons } from "@/components/icons";

export function DocumentsCard() {
  return (
    <Card title="Documents & sources" sub="Ce que Nepteo a lu">
      <div className="px-[22px] py-6">
        <p className="text-[13px] font-medium text-ink">
          Aucun document pour l&apos;instant
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Votre site internet, catalogue et documents commerciaux pourront être
          lus par Nepteo à l&apos;arrivée des connecteurs.
        </p>
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
