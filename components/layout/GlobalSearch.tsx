"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useApiData";
import { formatTimeAgo } from "@/utils/format";

/** Header search box with a debounced global lookup across the whole app. */

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchResponse {
  employees: SearchHit[];
  skills: SearchHit[];
  projects: SearchHit[];
  departments: SearchHit[];
}

const GROUP_LABELS: Record<string, string> = {
  employees: "Employees",
  skills: "Skills",
  projects: "Projects",
  departments: "Departments",
};

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const debounced = useDebounced(term, 250);

  // Fetch only once the user has typed enough to be meaningful.
  React.useEffect(() => {
    const query = debounced.trim();
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    api
      .get<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&limit=5`)
      .then(({ data }) => {
        if (!cancelled) {
          setResults(data);
          setOpen(true);
        }
      })
      .catch(() => {
        // Search is best-effort: a failure must never block the header.
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Close the dropdown when the user clicks elsewhere.
  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // "/" focuses the search box, as in most developer tools.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      event.preventDefault();
      boxRef.current?.querySelector("input")?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = results
    ? (Object.keys(GROUP_LABELS) as Array<keyof SearchResponse>).filter(
        (key) => (results[key] as SearchHit[]).length > 0
      )
    : [];

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">
        Search employees, skills, projects and departments
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 103.4 9.8l3.63 3.64a.75.75 0 101.06-1.06l-3.64-3.63A5.5 5.5 0 009 3.5zM5 9a4 4 0 118 0 4 4 0 01-8 0z"
            clipRule="evenodd"
          />
        </svg>
        <input
          id="global-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search employees, skills, projects..."
          className="input pl-9 pr-12"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
          {loading ? "..." : null}
        </span>
      </div>

      {open && results ? (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-ink-200 bg-white shadow-pop"
          role="listbox"
        >
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">
              No matches for &ldquo;{debounced.trim()}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group} className="border-b border-ink-100 last:border-0">
                <p className="bg-ink-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {GROUP_LABELS[group]}
                </p>
                {(results[group] as SearchHit[]).map((hit) => (
                  <Link
                    key={`${group}-${hit.id}`}
                    href={hit.href}
                    onClick={() => go(hit.href)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-ink-50"
                    role="option"
                    aria-selected={false}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-800">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {hit.subtitle}
                      </span>
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 shrink-0 text-ink-300"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.06-1.06l4.5 4.25a.75.75 0 010 1.04l-4.5 4.25a.75.75 0 01-1.06 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export { formatTimeAgo };