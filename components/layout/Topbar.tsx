"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserCircleIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar } from "@/components/ui/Card";
import { ROLE_STYLES } from "@/utils/badges";
import { USER_ROLE_LABELS, type UserRole } from "@/types";
import { cn } from "@/utils/cn";

/** Sticky application header: search, notifications and the account menu. */
export function Topbar({
  name,
  email,
  image,
  role,
}: {
  name: string;
  email: string | null;
  image: string | null;
  role: UserRole;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    // Auth.js clears the session cookie; the callback then reloads the app.
    await signOut({ callbackUrl: "/" });
    setSigningOut(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="min-w-0 flex-1 lg:max-w-md">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />

        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-ink-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={name} src={image} size="sm" />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-medium text-ink-800">
                {name}
              </span>
              <span className="block text-[11px] text-ink-500">
                {USER_ROLE_LABELS[role]}
              </span>
            </span>
          </button>

          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop"
              role="menu"
            >
              <div className="border-b border-ink-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
                <p className="truncate text-xs text-ink-500">{email ?? "—"}</p>
                <span className={cn("badge mt-2", ROLE_STYLES[role] ?? "badge-neutral")}>
                  {USER_ROLE_LABELS[role]}
                </span>
              </div>

              <div className="p-1.5">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-100"
                  role="menuitem"
                >
                  <UserCircleIcon className="h-[18px] w-[18px]" aria-hidden />
                  My profile
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
                  role="menuitem"
                >
                  <ArrowRightStartOnRectangleIcon className="h-[18px] w-[18px]" aria-hidden />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}