export function MemoryGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[.09em] text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}
