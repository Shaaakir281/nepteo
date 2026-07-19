export function Card({
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
