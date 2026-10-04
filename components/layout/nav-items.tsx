import type { ComponentType } from "react";
import type { Permission } from "@/lib/auth/permissions";
import {
  BookOpenIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CogIcon,
  FolderIcon,
  Squares2X2Icon,
  PuzzlePieceIcon,
  SparklesIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

/**
 * Sidebar navigation model.
 *
 * Each entry declares the permission it needs; the shell renders only the items
 * the signed-in role can actually use. This is a UX convenience only — every
 * route and API re-checks the permission server-side.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Squares2X2Icon, permission: "dashboard:read" },
      { label: "Workload", href: "/workload", icon: ChartBarIcon, permission: "workload:read" },
      { label: "Skill gaps", href: "/skill-gaps", icon: PuzzlePieceIcon, permission: "skillgap:read" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Employees", href: "/employees", icon: UsersIcon, permission: "employee:read" },
      { label: "Training", href: "/training", icon: BookOpenIcon, permission: "training:read" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Projects", href: "/projects", icon: FolderIcon, permission: "project:read" },
      { label: "Allocation", href: "/allocation", icon: BriefcaseIcon, permission: "allocation:read" },
      { label: "Reports", href: "/reports", icon: ClipboardDocumentCheckIcon, permission: "report:read" },
    ],
  },
  {
    title: "Catalogue",
    items: [{ label: "Skills", href: "/skills", icon: SparklesIcon, permission: "skill:read" }],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: UserGroupIcon, permission: "user:manage" },
      { label: "Settings", href: "/admin/settings", icon: CogIcon, permission: "settings:manage" },
    ],
  },
];

/** Flat list of the hrefs a role can reach (used by the mobile menu). */
export function allowedHrefs(permissions: Permission[]): Set<string> {
  return new Set(
    NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter((item) => !item.permission || permissions.includes(item.permission))
        .map((item) => item.href)
    )
  );
}