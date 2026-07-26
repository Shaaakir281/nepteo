import { redirect } from "next/navigation";

/**
 * `/agent` a été fusionné dans « Mon entreprise » (onglet Agent). La route
 * reste vivante et redirige : le guide de test, les bulles et les liens
 * « entreprise fictive » déjà partagés continuent de fonctionner.
 */
export default async function AgentPage() {
  redirect("/entreprise?onglet=agent");
}
