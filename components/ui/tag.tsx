export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-tint px-3 py-1 text-[12px] font-semibold text-violet-ink">
      {children}
    </span>
  );
}

export function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </span>
  );
}
