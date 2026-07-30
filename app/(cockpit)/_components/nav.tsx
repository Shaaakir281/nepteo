"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons } from "@/components/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiresFinancialAccess?: boolean;
}

/**
 * Une seule définition des cinq destinations, partagée par la barre latérale
 * desktop et la navigation mobile.
 */
export const COCKPIT_NAV_ITEMS: NavItem[] = [
  { label: "Aujourd'hui", href: "/", icon: icons.star },
  { label: "Prospects", href: "/prospects", icon: icons.people },
  {
    label: "Campagnes",
    href: "/campagnes",
    icon: icons.send,
    requiresFinancialAccess: true,
  },
  { label: "Mon entreprise", href: "/entreprise", icon: icons.house },
  { label: "Journal", href: "/journal", icon: icons.journal },
];

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/entreprise" && pathname.startsWith("/connecteurs/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CockpitNav({
  items = COCKPIT_NAV_ITEMS,
  canViewFinancials = false,
}: {
  items?: NavItem[];
  canViewFinancials?: boolean;
}) {
  const pathname = usePathname();
  const visibleItems = items.filter(
    (item) => canViewFinancials || !item.requiresFinancialAccess,
  );

  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 px-3">
      {visibleItems.map((it) => {
        const on = isCurrentPath(pathname, it.href);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={on ? "page" : undefined}
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

export function MobileCockpitNav({
  canViewFinancials = false,
}: {
  canViewFinancials?: boolean;
}) {
  const pathname = usePathname();
  const visibleItems = COCKPIT_NAV_ITEMS.filter(
    (item) => canViewFinancials || !item.requiresFinancialAccess,
  );

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(25,23,49,.08)] backdrop-blur lg:hidden"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map((item) => {
          const on = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px] leading-tight transition ${
                on
                  ? "font-semibold text-violet-ink"
                  : "font-medium text-muted hover:bg-tint-soft hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={on ? "text-violet" : "text-faint"}
              >
                {item.icon}
              </span>
              <span className="max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
