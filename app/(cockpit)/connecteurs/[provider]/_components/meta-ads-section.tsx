import { SAVE_BTN } from "@/components/ui/styles";
import {
  readMetaAdAccountCandidates,
  readMetaInsightSnapshot,
  readSelectedMetaAdAccount,
} from "@/lib/connectors/meta-ads";
import {
  listMetaAccounts,
  readMetaInsightsNow,
  saveMetaAdAccount,
} from "../actions";

export function MetaAdsSection({
  config,
  canEdit,
  paused,
}: {
  config: Record<string, unknown>;
  canEdit: boolean;
  paused: boolean;
}) {
  const accounts = readMetaAdAccountCandidates(config);
  const selected = readSelectedMetaAdAccount(config);
  const snapshot = readMetaInsightSnapshot(config);

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="border-b border-line-soft px-[22px] py-4">
          <h3 className="font-display text-[15px] font-semibold">Compte publicitaire à lire</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Nepteo ne choisit jamais un compte à votre place. La liste est lue uniquement après votre clic.
          </p>
        </div>
        <div className="p-[22px]">
          {selected && (
            <p className="mb-3 rounded-[10px] bg-green-tint px-3.5 py-2.5 text-[13px] text-green">
              Compte sélectionné : <b>{selected.name}</b> · {selected.currency} · {selected.timezone}
            </p>
          )}
          {canEdit && (
            <form action={listMetaAccounts} className="mb-4">
              <button
                type="submit"
                disabled={paused}
                className={`${SAVE_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Lire mes comptes publicitaires
              </button>
              {paused && (
                <span className="ml-3 text-[12.5px] text-amber">Lecture en pause.</span>
              )}
            </form>
          )}
          {accounts.length > 0 ? (
            <form action={saveMetaAdAccount} className="space-y-2">
              <p className="text-[12.5px] text-muted">Choisissez explicitement le compte à observer.</p>
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] font-medium text-ink has-[:checked]:border-violet has-[:checked]:bg-tint-soft"
                >
                  <input
                    type="radio"
                    name="account_id"
                    value={account.id}
                    defaultChecked={selected?.id === account.id}
                    required
                    className="accent-violet"
                  />
                  <span>
                    {account.name} <span className="font-normal text-muted">· {account.currency} · {account.timezone}</span>
                  </span>
                </label>
              ))}
              {canEdit && <button type="submit" className={`${SAVE_BTN} mt-2`}>Enregistrer ce compte</button>}
            </form>
          ) : (
            <p className="text-[13px] text-muted">
              Aucun compte n&apos;est affiché tant que vous n&apos;avez pas demandé cette lecture.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="border-b border-line-soft px-[22px] py-4">
          <h3 className="font-display text-[15px] font-semibold">Métriques de campagne</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Lecture manuelle bornée à 100 lignes et 7, 14 ou 30 jours. Aucune action Ads n&apos;est disponible.
          </p>
        </div>
        <div className="p-[22px]">
          {canEdit && selected && (
            <form action={readMetaInsightsNow} className="flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="submit"
                  name="days"
                  value={days}
                  disabled={paused}
                  className={`${SAVE_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Lire {days} jours
                </button>
              ))}
            </form>
          )}
          {!selected && (
            <p className="text-[13px] text-muted">Sélectionnez d&apos;abord un compte publicitaire.</p>
          )}
          {paused && selected && (
            <p className="mt-3 text-[12.5px] text-amber">Lecture en pause : aucune requête Meta ne peut démarrer.</p>
          )}
          {snapshot && (
            <div className="mt-4">
              <p className="text-[13px] font-medium text-ink">
                Dernier relevé : {snapshot.rows.length} ligne{snapshot.rows.length > 1 ? "s" : ""} du {snapshot.observation_from} au {snapshot.observation_to} ({snapshot.currency}).
              </p>
              {snapshot.rows.length > 0 && (
                <ul className="mt-2 space-y-1.5 text-[12.5px] text-body">
                  {snapshot.rows.slice(0, 5).map((row) => (
                    <li key={`${row.campaign_id}-${row.date}`}>
                      <b>{row.campaign_name}</b> Â· {row.date} Â· {row.impressions} impressions Â· {row.clicks} clics Â· {row.spend} {snapshot.currency}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
