import { permanentRedirect } from "next/navigation";

/**
 * « Plan du mois » a rejoint Aujourd'hui : le cap du mois y est rendu en
 * bandeau (`_components/plan-banner.tsx`), et l'état sans données y affiche
 * déjà le diagnostic de départ. Aucun écran n'est perdu — d'où la redirection
 * permanente. Le moteur `lib/plan.ts` n'a pas bougé.
 */
export default async function PlanPage() {
  permanentRedirect("/");
}
