import { SAVE_BTN } from "@/components/ui/styles";
import type { MetaPilotAccessRequest } from "@/lib/connectors/meta-pilot-access";
import { requestMetaPilotAccess } from "../actions";

const OAUTH_URL = "/api/connectors/meta_ads/authorize";

function OAuthButton({ label }: { label: string }) {
  return (
    <a
      href={OAUTH_URL}
      className="inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
    >
      {label}
    </a>
  );
}

export function MetaPilotAccessSection({
  request,
  canEdit,
}: {
  request: MetaPilotAccessRequest | null;
  canEdit: boolean;
}) {
  const pending = request?.status === "requested";
  const ready = request?.status === "ready";

  return (
    <section className="rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="border-b border-line-soft px-[22px] py-4">
        <h2 className="font-display text-[16px] font-semibold text-ink">
          Accès pilote Meta Ads
        </h2>
        <p className="mt-1 text-[13px] text-body">
          L’application Meta de Nepteo est encore en mode développement. Meta
          autorise uniquement les comptes ajoutés manuellement comme testeurs.
        </p>
      </div>

      <div className="space-y-4 p-[22px]">
        {pending && (
          <div className="rounded-[10px] bg-green-tint px-4 py-3 text-[13px] text-green">
            <p className="font-semibold">Votre demande d’accès a bien été reçue.</p>
            <p className="mt-1">
              L’équipe Nepteo vérifiera manuellement votre compte et vous
              contactera à <b>{request.facebook_email}</b> dès que vous pourrez
              finaliser la connexion.
            </p>
          </div>
        )}

        {ready && (
          <div className="rounded-[10px] bg-green-tint px-4 py-3 text-[13px] text-green">
            <p className="font-semibold">Votre accès pilote est prêt.</p>
            <p className="mt-1">
              Vous pouvez maintenant ouvrir l’écran officiel Meta et autoriser
              uniquement la lecture de vos publicités.
            </p>
          </div>
        )}

        {!pending && !ready && canEdit && (
          <form action={requestMetaPilotAccess} className="space-y-3">
            <div>
              <label htmlFor="meta-facebook-email" className="block text-[12.5px] font-semibold text-ink">
                Adresse e-mail associée au compte Facebook
              </label>
              <input
                id="meta-facebook-email"
                name="facebook_email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                className="mt-1.5 w-full rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-violet"
              />
            </div>
            <div>
              <label htmlFor="meta-facebook-profile" className="block text-[12.5px] font-semibold text-ink">
                Lien du profil Facebook <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <input
                id="meta-facebook-profile"
                name="facebook_profile_url"
                type="url"
                inputMode="url"
                placeholder="https://www.facebook.com/votre-profil"
                maxLength={500}
                className="mt-1.5 w-full rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-violet"
              />
            </div>
            <button type="submit" className={SAVE_BTN}>Demander l’accès pilote</button>
          </form>
        )}

        {!canEdit && !request && (
          <p className="text-[13px] text-muted">
            Un membre autorisé de votre organisation doit demander l’accès pilote.
          </p>
        )}

        <div className="rounded-[10px] bg-tint-soft px-4 py-3 text-[12.5px] text-body">
          <p className="font-semibold text-ink">Ce que Nepteo ne vous demandera jamais</p>
          <p className="mt-1">
            Ne transmettez ni mot de passe Facebook, ni jeton Meta, ni identifiant
            d’application, ni secret. La validation du rôle testeur reste manuelle
            et Nepteo demande seulement la permission <code>ads_read</code>.
          </p>
        </div>

        {canEdit && ready && (
          <div className="space-y-2 border-t border-line-soft pt-4">
            <p className="text-[12.5px] text-muted">
              Meta ouvrira son propre écran de consentement.
            </p>
            <OAuthButton label="Finaliser la connexion Meta" />
          </div>
        )}

        {canEdit && pending && (
          <p className="border-t border-line-soft pt-4 text-[12.5px] text-muted">
            Attendez le message de confirmation de Nepteo avant de revenir ici :
            la connexion Meta sera alors déverrouillée.
          </p>
        )}

        {canEdit && !request && (
          <div className="space-y-2 border-t border-line-soft pt-4">
            <p className="text-[12.5px] text-muted">
              Déjà ajouté comme testeur de l’application Meta ? Vous pouvez
              continuer directement.
            </p>
            <OAuthButton label="J’ai déjà un accès testeur" />
          </div>
        )}
      </div>
    </section>
  );
}
