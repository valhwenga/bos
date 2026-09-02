import { useEffect, useState } from "react";
import { AuthStore, type Account } from "./authStore";

/**
 * The staff directory, for screens that show who a task is assigned to or who
 * raised a ticket.
 *
 * The accounts used to sit in localStorage, so any component could read them
 * synchronously during render. They are a server read now, so this loads them
 * once into a shared cache rather than having each of the five screens that
 * needs a name issue its own request on every mount.
 *
 * Returns an empty list while loading. Callers render a name from it, so an
 * empty list briefly shows nothing rather than the wrong thing.
 */

let cache: Account[] | null = null;
let inFlight: Promise<Account[]> | null = null;
const listeners = new Set<(a: Account[]) => void>();

async function load(): Promise<Account[]> {
  if (!inFlight) {
    inFlight = AuthStore.listAccounts()
      .then((rows) => {
        cache = rows;
        for (const fn of listeners) fn(rows);
        return rows;
      })
      .catch(() => {
        // A user without permission to list profiles gets an empty directory
        // rather than an error; the screens that use it degrade to showing ids.
        cache = [];
        for (const fn of listeners) fn([]);
        return [];
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Drops the cache so the next read re-fetches, after a role or status change. */
export function invalidateAccounts(): void {
  cache = null;
  void load();
}

export function useAccounts(): Account[] {
  const [accounts, setAccounts] = useState<Account[]>(cache ?? []);

  useEffect(() => {
    listeners.add(setAccounts);
    if (cache) setAccounts(cache);
    else void load();
    return () => {
      listeners.delete(setAccounts);
    };
  }, []);

  return accounts;
}
