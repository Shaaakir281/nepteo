import Link from "next/link";
import { ExecutionSwitch } from "./execution-switch";

export function TodayFooter({
  canEdit,
  executionPaused,
}: {
  canEdit: boolean;
  executionPaused: boolean | null;
}) {
  return (
    <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-faint">
      {canEdit ? (
        <ExecutionSwitch paused={executionPaused} />
      ) : (
        <span className="font-semibold text-green">✓ Mode sûr</span>
      )}
      <Link href="/entreprise" className="border-b border-line hover:text-violet">
        Ma fiche
      </Link>
      <Link
        href="/entreprise?onglet=connecteurs"
        className="border-b border-line hover:text-violet"
      >
        Mes outils
      </Link>
      {canEdit && (
        <>
          <Link
            href="/entreprise?onglet=connecteurs"
            className="border-b border-line hover:text-violet"
          >
            Scénario d&apos;exemple
          </Link>
        </>
      )}
    </footer>
  );
}
