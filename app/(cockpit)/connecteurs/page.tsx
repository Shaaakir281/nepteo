import { redirect } from "next/navigation";

/**
 * `/connecteurs` a été fusionné dans « Mon entreprise » (onglet Connecteurs).
 * La route reste vivante et redirige : les liens existants, les favoris et les
 * retours OAuth continuent de fonctionner. Les `searchParams` sont conservés —
 * un `?saved=notion` ou un `?error=…` ne doit pas se perdre dans le trajet.
 */
export default async function ConnecteursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams({ onglet: "connecteurs" });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  redirect(`/entreprise?${params.toString()}`);
}
