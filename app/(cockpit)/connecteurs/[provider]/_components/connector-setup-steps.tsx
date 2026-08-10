export function ConnectorSetupSteps({
  authorized,
  configured,
}: {
  authorized: boolean;
  configured: boolean;
}) {
  const current = !authorized ? 1 : !configured ? 2 : 3;
  const labels = ["Autoriser", "Choisir la source", "Lire les données"];

  return (
    <ol aria-label="Progression de la connexion" className="mb-4 flex items-center gap-2 text-[11.5px]">
      {labels.map((label, index) => {
        const step = index + 1;
        return (
          <li key={label} className={`flex items-center gap-1.5 ${step === current ? "font-semibold text-violet-ink" : step < current ? "text-green" : "text-faint"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full ${step === current ? "bg-violet text-white" : step < current ? "bg-green-tint" : "bg-tint-soft"}`}>
              {step < current ? "✓" : step}
            </span>
            <span className="max-sm:sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
