import type { ReactNode } from "react";

export function TodayDetails({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-line-soft">
      <summary className="flex cursor-pointer items-center gap-3 px-1 py-3 text-[12.5px] font-semibold text-ink">
        <span className="text-[15px] text-faint transition group-open:rotate-90">›</span>
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[10.5px] text-muted">
            {count}
          </span>
        )}
      </summary>
      <div className="pb-4 pl-7 pr-1">{children}</div>
    </details>
  );
}
