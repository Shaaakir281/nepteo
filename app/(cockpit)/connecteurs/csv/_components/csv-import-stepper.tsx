"use client";

import { useState, type ChangeEvent } from "react";
import { clearCsvProspects, importCsvProspects } from "../actions";

function previewHeaders(text: string): string[] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) ?? "";
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  return firstLine.split(delimiter).map((value) => value.replace(/^"|"$/g, "").trim()).filter(Boolean).slice(0, 12);
}

export function CsvImportStepper({
  canEdit,
  demoActive,
  fileName,
  hasImport,
  maxBytes,
}: {
  canEdit: boolean;
  demoActive: boolean;
  fileName?: string;
  hasImport: boolean;
  maxBytes: number;
}) {
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(null);
    setHeaders([]);
    if (!file) return;
    if (!file.name.toLocaleLowerCase("fr-FR").endsWith(".csv")) {
      setClientError("Choisissez un fichier avec l’extension .csv.");
      return;
    }
    if (file.size === 0) {
      setClientError("Le fichier CSV est vide.");
      return;
    }
    if (file.size > maxBytes) {
      setClientError("Le fichier dépasse la limite de 900 Ko.");
      return;
    }
    setClientError(null);
    setSelectedFile(file);
    try {
      setHeaders(previewHeaders(await file.text()));
    } catch {
      setClientError("Le fichier ne peut pas être lu. Enregistrez-le au format CSV UTF-8.");
    }
  }

  if (!canEdit) {
    return <p className="mt-5 rounded-[10px] bg-tint-soft px-4 py-3 text-[12.5px] text-muted">Votre rôle permet de consulter les prospects, pas de les importer.</p>;
  }

  return (
    <>
      <ol aria-label="Progression de l’import CSV" className="mt-5 flex items-center gap-2 text-[11.5px]">
        {["Déposer", "Vérifier", "Confirmer"].map((label, index) => (
          <li key={label} className={`flex items-center gap-1.5 ${step === index + 1 ? "font-semibold text-violet-ink" : "text-faint"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full ${step === index + 1 ? "bg-violet text-white" : "bg-tint-soft"}`}>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <form action={importCsvProspects} className="mt-4">
        <section className={step === 1 ? "block" : "hidden"} aria-hidden={step !== 1}>
          <h2 className="font-display text-[16px] font-semibold">Quel fichier voulez-vous importer ?</h2>
          {demoActive ? (
            <p className="mt-3 rounded-[10px] bg-amber-tint px-4 py-3 text-[12.5px] text-body"><b>Scénario Nepteo actif.</b> Retirez-le avant l&apos;import pour éviter tout mélange avec les données du testeur.</p>
          ) : (
            <label className="mt-3 block">
              <span className="sr-only">Fichier CSV</span>
              <input
                name="csv"
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => void selectFile(event)}
                className="block w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-[12.5px] file:mr-3 file:rounded-[7px] file:border-0 file:bg-tint file:px-3 file:py-1.5 file:font-semibold file:text-violet"
              />
            </label>
          )}
          <p className="mt-2 text-[11.5px] text-faint" title="Les exigences détaillées et le mapping seront affichés après le dépôt.">CSV, 900 Ko max <span aria-hidden="true">ⓘ</span></p>
          {clientError && <p role="alert" className="mt-3 rounded-[10px] bg-red-tint px-3 py-2 text-[12px] font-medium text-red">{clientError}</p>}
          <button type="button" disabled={!selectedFile || Boolean(clientError)} onClick={() => setStep(2)} className="mt-4 rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-40">Vérifier les colonnes</button>
        </section>

        <section className={step === 2 ? "block" : "hidden"} aria-hidden={step !== 2}>
          <h2 className="font-display text-[16px] font-semibold">Vérifier les colonnes</h2>
          <p className="mt-2 text-[12.5px] text-body"><b>{selectedFile?.name}</b> · {headers.length > 0 ? `${headers.length} en-têtes détectés` : "en-têtes à valider"}</p>
          {headers.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{headers.map((header) => <span key={header} className="rounded-full bg-tint px-2.5 py-1 text-[11px] text-violet-ink">{header}</span>)}</div>}
          <details className="mt-4 rounded-[10px] border border-line-soft px-3 py-2 text-[11.5px] text-muted">
            <summary className="cursor-pointer font-semibold text-body">Mapping et exigences de l’import</summary>
            <p className="mt-2 leading-relaxed">Nepteo validera précisément l’UTF-8, la limite de 5 000 lignes, le séparateur, les en-têtes non ambigus et les six champs reconnus. Les autres colonnes ne sont ni importées ni stockées.</p>
          </details>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-[9px] border border-line px-4 py-2 text-[12px] font-semibold">Retour</button>
            <button type="button" onClick={() => setStep(3)} className="rounded-[9px] bg-violet px-4 py-2 text-[12px] font-semibold text-white">Continuer</button>
          </div>
        </section>

        <section className={step === 3 ? "block" : "hidden"} aria-hidden={step !== 3}>
          <h2 className="font-display text-[16px] font-semibold">Confirmer {fileName ? "le remplacement" : "l’import"}</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-body">{fileName ? <>L’import <b>{fileName}</b> sera remplacé par <b>{selectedFile?.name}</b>. Les autres connecteurs resteront intacts.</> : <>Le fichier <b>{selectedFile?.name}</b> deviendra votre source CSV.</>}</p>
          <label className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-line-soft bg-tint-soft px-3.5 py-3 text-[12px] leading-relaxed text-body">
            <input type="checkbox" name="data_authorized" required className="mt-0.5" />
            <span>Je confirme que ces données sont autorisées pour ce test et ne contiennent que les colonnes utiles. Les champs reconnus peuvent alimenter les analyses et brouillons ; l’email et les en-têtes ne sont pas copiés dans le contexte libre envoyé au modèle.</span>
          </label>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-[9px] border border-line px-4 py-2 text-[12px] font-semibold">Retour</button>
            <button type="submit" className="rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white">{fileName ? "Remplacer l'import CSV" : "Importer et analyser ensuite"}</button>
          </div>
        </section>
      </form>

      {hasImport && (
        <details className="mt-6 border-t border-line-soft pt-4">
          <summary className="cursor-pointer text-[12px] font-semibold text-red">Retirer l&apos;import CSV</summary>
          <form action={clearCsvProspects} className="mt-3">
            <p className="text-[11.5px] leading-relaxed text-faint">Le retrait supprime les contacts CSV, les propositions rattachées et le briefing courant. Le journal append-only et les recherches déjà demandées restent des traces d’audit/cache.</p>
            <label className="mt-3 flex items-start gap-2 text-[11.5px] text-body"><input type="checkbox" name="confirm_clear" required className="mt-0.5" /> Je confirme le retrait des contacts CSV et des contenus supprimables qui en dépendent.</label>
            <button type="submit" className="mt-3 text-[12px] font-semibold text-red hover:underline">Confirmer le retrait</button>
          </form>
        </details>
      )}
    </>
  );
}
