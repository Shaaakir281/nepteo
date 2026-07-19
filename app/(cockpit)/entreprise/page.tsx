import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  EDIT_ROLES,
  OBJECTIVE_OPTIONS,
  type MemoryContent,
  type Offer,
} from "@/lib/memory";
import {
  deleteOffer,
  saveActivite,
  saveCanaux,
  saveObjectifs,
  saveOffer,
  saveTon,
  saveZone,
} from "./actions";

const FIELD =
  "w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15";
const SAVE_BTN =
  "rounded-[10px] bg-violet px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep";
const CHIP =
  "cursor-pointer select-none rounded-full border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition has-[:checked]:border-violet has-[:checked]:bg-tint-soft has-[:checked]:text-violet-ink has-[:checked]:shadow-[0_0_0_1px_var(--violet)]";

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-tint px-3 py-1 text-[12px] font-semibold text-violet-ink">
      {children}
    </span>
  );
}

function Card({
  title,
  sub,
  saved,
  children,
  className,
}: {
  title: string;
  sub: string;
  saved?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-line-soft bg-white shadow-card ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-[22px] py-4">
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        {saved ? (
          <span className="text-[11.5px] font-semibold text-green">
            Enregistré ✓
          </span>
        ) : (
          <span className="text-[12px] text-muted">{sub}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MemRow({
  label,
  value,
  sub,
  saved,
  canEdit,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: string;
  saved?: boolean;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-line-soft first:border-t-0">
      <summary
        className={`flex items-start gap-3 px-[22px] py-3.5 ${
          canEdit ? "cursor-pointer" : "pointer-events-none"
        }`}
      >
        <span className="w-[110px] flex-none pt-[3px] text-[11px] font-semibold uppercase tracking-[.05em] text-faint">
          {label}
        </span>
        <span className="flex-1 text-[13.5px] font-medium leading-[1.55] text-ink">
          {value ?? <span className="font-normal text-faint">À compléter</span>}
          {sub && (
            <span className="mt-0.5 block text-[12px] font-normal text-muted">
              {sub}
            </span>
          )}
        </span>
        {saved && (
          <span className="flex-none pt-[3px] text-[11.5px] font-semibold text-green">
            Enregistré ✓
          </span>
        )}
        {canEdit && (
          <>
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet group-open:hidden">
              Modifier
            </span>
            <span className="hidden flex-none rounded-[7px] bg-tint-soft px-3 py-[5px] text-[12px] font-semibold text-muted group-open:inline">
              Fermer
            </span>
          </>
        )}
      </summary>
      <div className="px-[22px] pb-5 md:pl-[132px]">{children}</div>
    </details>
  );
}

export default async function EntreprisePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const canEdit = EDIT_ROLES.includes(membership.role);

  const { data: rows } = await supabase
    .from("company_memory")
    .select("section, content");
  const mem: Partial<MemoryContent> = {};
  for (const r of rows ?? []) {
    (mem as Record<string, unknown>)[r.section] = r.content ?? {};
  }

  const offers: Offer[] = mem.offres?.items ?? [];
  const channels = mem.canaux?.list ?? [];
  const objectives = mem.objectifs?.list ?? [];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Votre entreprise
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          C&apos;est la <b className="text-ink">mémoire de Nepteo</b> : tout ce
          qu&apos;il sait pour personnaliser ses recommandations. Plus elle est
          juste, meilleures sont les propositions — chaque élément est
          modifiable et s&apos;applique immédiatement.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-[18px] border border-line bg-gradient-to-b from-[#fbfbff] to-[#f4f3fc] px-5 py-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-line bg-white text-violet">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 1.9-1 3.1-1.9 4-.6.6-.9 1.2-1 2H6.4c-.1-.8-.4-1.4-1-2-.9-.9-1.9-2.1-1.9-4A4.5 4.5 0 018 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6.5 14.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h4 className="font-display text-[13.5px] font-semibold">
            Remplissez ce que vous savez, comme vous le diriez à un client
          </h4>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
            Pas besoin des bons termes marketing. Nepteo enrichira ensuite cette
            mémoire avec ce qu&apos;il observe dans vos données — et vous
            garderez le dernier mot sur chaque apprentissage.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}
      {!canEdit && (
        <p className="mb-4 rounded-[10px] bg-tint-soft px-4 py-2.5 text-[13px] text-muted">
          Lecture seule — votre rôle ne permet pas la modification.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* ============ Colonne gauche ============ */}
        <div className="space-y-4">
          <Card title="Identité & activité" sub="Modifiable à tout moment">
            <MemRow
              label="Activité"
              canEdit={canEdit}
              saved={saved === "activite"}
              value={mem.activite?.activity_type}
              sub={
                mem.activite?.audience
                  ? `Clients : ${mem.activite.audience.toLowerCase()}`
                  : undefined
              }
            >
              <form action={saveActivite}>
                <p className="mb-2 text-[12px] font-semibold text-ink">
                  Que propose votre entreprise ?
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((o) => (
                    <label key={o} className={CHIP}>
                      <input
                        type="radio"
                        name="activity_type"
                        value={o}
                        defaultChecked={mem.activite?.activity_type === o}
                        className="sr-only"
                        required
                      />
                      {o}
                    </label>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">
                  À qui vendez-vous principalement ?
                </p>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((o) => (
                    <label key={o} className={CHIP}>
                      <input
                        type="radio"
                        name="audience"
                        value={o}
                        defaultChecked={mem.activite?.audience === o}
                        className="sr-only"
                        required
                      />
                      {o}
                    </label>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">
                  Avec vos propres mots{" "}
                  <span className="font-normal text-faint">(facultatif)</span>
                </p>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={1000}
                  defaultValue={mem.activite?.description ?? ""}
                  placeholder="Exemple : Nous fabriquons des menuiseries sur mesure pour des architectes et des particuliers, principalement en Île-de-France…"
                  className={FIELD}
                />
                <div className="mt-3">
                  <button type="submit" className={SAVE_BTN}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </MemRow>

            <MemRow
              label="Zone"
              canEdit={canEdit}
              saved={saved === "zone"}
              value={mem.zone?.text}
            >
              <form action={saveZone}>
                <input
                  name="text"
                  maxLength={200}
                  required
                  defaultValue={mem.zone?.text ?? ""}
                  placeholder="Ex. : France — principalement Île-de-France"
                  className={FIELD}
                />
                <div className="mt-3">
                  <button type="submit" className={SAVE_BTN}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </MemRow>

            <MemRow
              label="Canaux actuels"
              canEdit={canEdit}
              saved={saved === "canaux"}
              value={
                channels.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {channels.map((c) => (
                      <Tag key={c}>{c}</Tag>
                    ))}
                  </span>
                ) : undefined
              }
              sub="Comment vos clients vous trouvent aujourd'hui"
            >
              <form action={saveCanaux}>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((c) => (
                    <label key={c} className={CHIP}>
                      <input
                        type="checkbox"
                        name="channels"
                        value={c}
                        defaultChecked={channels.includes(c)}
                        className="sr-only"
                      />
                      {c}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <button type="submit" className={SAVE_BTN}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </MemRow>

            <MemRow
              label="Ton"
              canEdit={canEdit}
              saved={saved === "ton"}
              value={mem.ton?.text}
              sub="Utilisé pour tous les emails et publications rédigés par Nepteo"
            >
              <form action={saveTon}>
                <textarea
                  name="text"
                  rows={2}
                  maxLength={500}
                  required
                  defaultValue={mem.ton?.text ?? ""}
                  placeholder="Ex. : professionnel, direct, sans jargon"
                  className={FIELD}
                />
                <div className="mt-3">
                  <button type="submit" className={SAVE_BTN}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </MemRow>

            <MemRow
              label="Objectifs"
              canEdit={canEdit}
              saved={saved === "objectifs"}
              value={
                objectives.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {objectives.map((o) => (
                      <Tag key={o}>{o}</Tag>
                    ))}
                  </span>
                ) : undefined
              }
              sub="Le cockpit et les priorités s'organisent autour de ces objectifs"
            >
              <form action={saveObjectifs}>
                <p className="mb-2 text-[12px] text-muted">
                  Choisissez <b className="text-ink">deux objectifs maximum</b>{" "}
                  — l&apos;agent doit rester concentré.
                </p>
                <div className="flex flex-wrap gap-2">
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <label key={o} className={CHIP}>
                      <input
                        type="checkbox"
                        name="objectives"
                        value={o}
                        defaultChecked={objectives.includes(o)}
                        className="sr-only"
                      />
                      {o}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <button type="submit" className={SAVE_BTN}>
                    Enregistrer
                  </button>
                </div>
              </form>
            </MemRow>
          </Card>

          <Card
            title="Vos offres"
            sub="Ce que vous vendez"
            saved={saved === "offres"}
          >
            {offers.length === 0 && (
              <p className="px-[22px] pt-4 text-[13px] text-muted">
                Décrivez votre offre principale — Nepteo s&apos;en servira pour
                les campagnes et les contenus.
              </p>
            )}
            {offers.map((o, i) => (
              <details
                key={`${o.name}-${i}`}
                className="group mx-[22px] my-4 rounded-[13px] border border-line bg-[#fdfdff]"
              >
                <summary
                  className={`p-[18px] ${canEdit ? "cursor-pointer" : "pointer-events-none"}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-[14.5px] font-semibold text-ink">
                      {o.name}
                    </span>
                    {canEdit && (
                      <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet group-open:hidden">
                        Modifier
                      </span>
                    )}
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
                    {(
                      [
                        ["Prix", o.price],
                        ["Cible", o.target],
                        ["Résultat promis", o.promise],
                      ] as const
                    ).map(([l, v]) => (
                      <span key={l} className="block">
                        <span className="block text-[10.5px] font-semibold uppercase tracking-[.06em] text-faint">
                          {l}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] font-medium leading-[1.45] text-ink">
                          {v || "—"}
                        </span>
                      </span>
                    ))}
                  </span>
                </summary>
                {canEdit && (
                  <div className="border-t border-line-soft p-[18px]">
                    <form action={saveOffer} className="space-y-3">
                      <input type="hidden" name="index" value={i} />
                      <input name="name" required minLength={2} maxLength={80} defaultValue={o.name} placeholder="Nom de l'offre" className={FIELD} />
                      <div className="grid gap-3 md:grid-cols-3">
                        <input name="price" maxLength={200} defaultValue={o.price ?? ""} placeholder="Prix — ex. : 1 500 – 3 000 € / mois" className={FIELD} />
                        <input name="target" maxLength={200} defaultValue={o.target ?? ""} placeholder="Cible — ex. : PME de services" className={FIELD} />
                        <input name="promise" maxLength={200} defaultValue={o.promise ?? ""} placeholder="Résultat promis" className={FIELD} />
                      </div>
                      <button type="submit" className={SAVE_BTN}>
                        Enregistrer
                      </button>
                    </form>
                    <form action={deleteOffer} className="mt-2">
                      <input type="hidden" name="index" value={i} />
                      <button
                        type="submit"
                        className="text-[12px] font-semibold text-red hover:underline"
                      >
                        Supprimer cette offre
                      </button>
                    </form>
                  </div>
                )}
              </details>
            ))}

            {canEdit && (
              <details className="group mx-[22px] mb-[18px] mt-2">
                <summary className="flex cursor-pointer items-center justify-center gap-2 rounded-[13px] border-[1.5px] border-dashed border-[#d5d2e8] px-4 py-[11px] text-[13px] font-semibold text-violet transition hover:bg-tint-soft group-open:hidden">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Ajouter une offre
                </summary>
                <form
                  action={saveOffer}
                  className="space-y-3 rounded-[13px] border border-line bg-[#fdfdff] p-[18px]"
                >
                  <p className="text-[12.5px] text-muted">
                    Une <b className="text-ink">offre</b>, c&apos;est ce que
                    vous vendez : un service, un produit, un abonnement ou une
                    prestation.
                  </p>
                  <input type="hidden" name="index" value="new" />
                  <input name="name" required minLength={2} maxLength={80} placeholder="Nom de l'offre — ex. : Accompagnement IA pour PME" className={FIELD} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <input name="price" maxLength={200} placeholder="Prix — ex. : 1 500 – 3 000 € / mois" className={FIELD} />
                    <input name="target" maxLength={200} placeholder="Cible — ex. : PME de services, 5 à 50 salariés" className={FIELD} />
                    <input name="promise" maxLength={200} placeholder="Résultat promis" className={FIELD} />
                  </div>
                  <button type="submit" className={SAVE_BTN}>
                    Ajouter l&apos;offre
                  </button>
                </form>
              </details>
            )}
          </Card>
        </div>

        {/* ============ Colonne droite ============ */}
        <div className="space-y-4">
          <Card title="Documents & sources" sub="Ce que Nepteo a lu">
            <div className="px-[22px] py-6">
              <p className="text-[13px] font-medium text-ink">
                Aucun document pour l&apos;instant
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Votre site internet, catalogue et documents commerciaux
                pourront être lus par Nepteo à l&apos;arrivée des connecteurs.
              </p>
              <span className="mt-4 flex cursor-default items-center justify-center gap-2 rounded-[13px] border-[1.5px] border-dashed border-line px-4 py-[11px] text-[13px] font-semibold text-faint">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Ajouter un document — bientôt
              </span>
            </div>
          </Card>

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
                <svg className="mt-0.5 flex-none" width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="#5a4fe0" strokeWidth="1.3" />
                  <path d="M8 7.2v3.3" stroke="#5a4fe0" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="5.1" r=".8" fill="#5a4fe0" />
                </svg>
                <span>
                  Ces observations resteront des <b>hypothèses</b> tant que
                  vous ne les aurez pas confirmées. Confirmées, elles
                  renforcent les recommandations ; corrigées, Nepteo apprend de
                  votre retour.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
