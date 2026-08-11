export function OnboardingBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3.5 text-[12px] text-faint hover:text-ink hover:underline"
    >
      ← Retour
    </button>
  );
}
