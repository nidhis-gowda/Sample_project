"use client";

import * as React from "react";
import { api, errorMessage } from "@/hooks/useApi";

/**
 * Minimal GET hook used by the list/filter screens.
 *
 * It re-fetches whenever `path` changes, exposes loading/error state for the
 * skeletons and error states, and silently ignores responses that arrive after
 * the path has moved on.
 */
export function useApiData<T>(path: string | null, deps: React.DependencyList = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [meta, setMeta] = React.useState<Record<string, unknown> | undefined>(undefined);
  const [loading, setLoading] = React.useState(Boolean(path));
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result.data);
        setMeta(result.meta);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadToken, ...deps]);

  const reload = React.useCallback(() => setReloadToken((value) => value + 1), []);

  return { data, meta, loading, error, reload, setData };
}

/** Debounces a rapidly changing value (search boxes, sliders). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}