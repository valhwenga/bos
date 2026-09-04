import { useEffect, useState } from "react";

/**
 * A read-through cache over a server collection.
 *
 * The app was built against localStorage, so it reads data synchronously during
 * render — `useState(AccountingStore.listInvoices())` and the like, in dozens of
 * places. Postgres reads are asynchronous. Rather than rewrite every one of
 * those call sites, rows are fetched once into memory and served synchronously
 * from there; components subscribe so they re-render when the data arrives or
 * changes.
 *
 * Writes go to the server first and the cache is refreshed from the result, so
 * the cache never claims a save that did not happen. That is the important
 * difference from the localStorage version, where the write could not fail.
 */
export type Cache<T> = {
  /** Rows held right now. Empty until the first load resolves. */
  list(): T[];
  /** Fetches, unless already loaded. */
  ensureLoaded(): Promise<T[]>;
  /** Fetches again, discarding what is held. */
  refresh(): Promise<T[]>;
  /** Runs a write, then refreshes so callers see the server's version. */
  mutate<R>(fn: () => Promise<R>): Promise<R>;
  subscribe(fn: () => void): () => void;
  /** True while a fetch is in flight and nothing has loaded yet. */
  isLoading(): boolean;
  /** The last load error, if the most recent attempt failed. */
  error(): Error | null;
  /** Drops everything held, for sign-out. */
  clear(): void;
};

export function createCache<T>(fetcher: () => Promise<T[]>): Cache<T> {
  let rows: T[] = [];
  let loaded = false;
  let loading = false;
  let lastError: Error | null = null;
  let inFlight: Promise<T[]> | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const fn of listeners) fn();
  };

  const load = (): Promise<T[]> => {
    if (inFlight) return inFlight;
    loading = true;
    notify();
    inFlight = fetcher()
      .then((next) => {
        rows = next;
        loaded = true;
        lastError = null;
        return next;
      })
      .catch((err: unknown) => {
        // Keep whatever was already loaded rather than blanking the screen; the
        // error is exposed so callers can say the data may be stale.
        lastError = err instanceof Error ? err : new Error(String(err));
        return rows;
      })
      .finally(() => {
        loading = false;
        inFlight = null;
        notify();
      });
    return inFlight;
  };

  return {
    list: () => rows,
    isLoading: () => loading && !loaded,
    error: () => lastError,
    ensureLoaded: () => (loaded ? Promise.resolve(rows) : load()),
    refresh: () => {
      loaded = false;
      return load();
    },
    async mutate<R>(fn: () => Promise<R>): Promise<R> {
      const result = await fn();
      loaded = false;
      await load();
      return result;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    clear() {
      rows = [];
      loaded = false;
      lastError = null;
      notify();
    },
  };
}

/**
 * Subscribes a component to a cache and triggers the first load.
 *
 * Returns the rows plus whether they are still loading, so a screen can tell
 * "no invoices yet" apart from "not loaded yet" — the localStorage version
 * could not, because there was never a gap between the two.
 */
export function useCache<T>(cache: Cache<T>): { rows: T[]; loading: boolean; error: Error | null } {
  const [, force] = useState(0);

  useEffect(() => {
    const unsubscribe = cache.subscribe(() => force((n) => n + 1));
    void cache.ensureLoaded();
    return unsubscribe;
  }, [cache]);

  return { rows: cache.list(), loading: cache.isLoading(), error: cache.error() };
}
