"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href?: string;
  soon?: string;
  icon: React.ReactNode;
}

export function CockpitNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map((it) => {
        if (!it.href) {
          return (
            <span
              key={it.label}
              className="flex cursor-default items-center gap-[11px] rounded-[10px] px-3 py-[9px] text-[13.5px] font-medium text-faint"
            >
              <span className="flex-none opacity-70">{it.icon}</span>
              {it.label}
              <span className="ml-auto whitespace-nowrap rounded-full bg-tint-soft px-2 py-0.5 text-[10px] font-semibold">
                {it.soon}
              </span>
            </span>
          );
        }
        const on = pathname === it.href;
        return (
          <Link
            key={it.label}
            href={it.href}
            className={`flex items-center gap-[11px] rounded-[10px] px-3 py-[9px] text-[13.5px] transition ${
              on
                ? "bg-tint font-semibold text-violet-ink"
                : "font-medium text-body hover:bg-tint-soft"
            }`}
          >
            <span className={`flex-none ${on ? "text-violet" : "text-faint"}`}>
              {it.icon}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
