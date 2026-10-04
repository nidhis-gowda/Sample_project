"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/utils/cn";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { NAV_SECTIONS } from "@/components/layout/nav-items";
import { ROLE_STYLES } from "@/utils/badges";
import { USER_ROLE_LABELS, type UserRole } from "@/types";
import type { Permission } from "@/lib/auth/permissions";

/** Dark application sidebar with role-aware navigation. */
export function Sidebar({
  role,
  permissions,
  appName,
}: {
  role: UserRole;
  permissions: Permission[];
  appName: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || permissions.includes(item.permission)
    ),
  })).filter((section) => section.items.length > 0);

  const nav = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 pb-6 pt-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn("nav-item", active && "nav-item-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto rounded-xl bg-white/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Signed in as
        </p>
        <span className={cn("badge mt-1.5", ROLE_STYLES[role] ?? "badge-neutral")}>
          {USER_ROLE_LABELS[role]}
        </span>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-900 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            SA
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-white">
            {appName}
          </span>
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="btn-ghost -ml-2 p-2"
          aria-label="Open navigation"
        >
          <Bars3Icon className="h-6 w-6" aria-hidden />
        </button>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-ink-900/60"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="relative flex h-full w-72 flex-col bg-ink-900 shadow-pop">
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
                <span className="truncate text-sm font-semibold text-white">{appName}</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded p-1.5 text-ink-300 hover:bg-white/10"
                  aria-label="Close navigation"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden />
                </button>
              </div>
              {nav}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}