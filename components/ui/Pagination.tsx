"use client";

import * as React from "react";
import { cn } from "@/utils/cn";

/**
 * Pagination control.
 *
 * With `basePath` it produces shareable links (`?page=2`); with `onPageChange`
 * it becomes a client-side control for screens that filter in memory.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath?: string;
  onPageChange?: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (target: number) =>
    !basePath || target <= 1 ? (basePath ?? "#") : `${basePath}?page=${target}`;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // A compact window around the current page keeps the control usable at scale.
  const windowSize = 2;
  const start = Math.max(1, page - windowSize);
  const end = Math.min(totalPages, page + windowSize);
  const pages: number[] = [];
  for (let index = start; index <= end; index += 1) pages.push(index);

  const go = (target: number) => {
    if (target < 1 || target > totalPages) return;
    if (onPageChange) onPageChange(target);
  };

  const buttonClass = (disabled: boolean) =>
    cn("btn-secondary btn-xs", disabled && "pointer-events-none opacity-40");

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-4 py-3"
      aria-label="Pagination"
    >
      <p className="text-xs text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}</span>–
        <span className="font-medium text-ink-700">{to}</span> of{" "}
        <span className="font-medium text-ink-700">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        {onPageChange ? (
          <button
            type="button"
            className={buttonClass(page <= 1)}
            onClick={() => go(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
        ) : (
          <a href={href(page - 1)} aria-disabled={page <= 1} className={buttonClass(page <= 1)}>
            Previous
          </a>
        )}

        {start > 1 ? (
          <>
            <PageLink page={1} label="1" current={page} basePath={basePath} onPageChange={onPageChange} />
            {start > 2 ? <span className="px-1 text-xs text-ink-400">…</span> : null}
          </>
        ) : null}

        {pages.map((value) => (
          <PageLink
            key={value}
            page={value}
            label={String(value)}
            current={page}
            basePath={basePath}
            onPageChange={onPageChange}
          />
        ))}

        {end < totalPages ? (
          <>
            {end < totalPages - 1 ? (
              <span className="px-1 text-xs text-ink-400">…</span>
            ) : null}
            <PageLink
              page={totalPages}
              label={String(totalPages)}
              current={page}
              basePath={basePath}
              onPageChange={onPageChange}
            />
          </>
        ) : null}

        {onPageChange ? (
          <button
            type="button"
            className={buttonClass(page >= totalPages)}
            onClick={() => go(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        ) : (
          <a href={href(page + 1)} aria-disabled={page >= totalPages} className={buttonClass(page >= totalPages)}>
            Next
          </a>
        )}
      </div>
    </nav>
  );
}

function PageLink({
  page,
  label,
  current,
  basePath,
  onPageChange,
}: {
  page: number;
  label: string;
  current: number;
  basePath?: string;
  onPageChange?: (page: number) => void;
}) {
  const className = cn(
    "btn-xs rounded-md px-2.5 py-1 font-medium",
    page === current ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
  );

  if (onPageChange) {
    return (
      <button
        type="button"
        onClick={() => onPageChange(page)}
        className={className}
        aria-current={page === current ? "page" : undefined}
      >
        {label}
      </button>
    );
  }

  return (
    <a
      href={`${basePath ?? ""}${page <= 1 ? "" : `?page=${page}`}`}
      className={className}
      aria-current={page === current ? "page" : undefined}
    >
      {label}
    </a>
  );
}