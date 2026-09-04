/**
 * Surfaces a write that failed and was not handled where it was made.
 *
 * Moving the stores onto Postgres turned a great many calls that could not fail
 * into calls that can. Most are awaited and reported at the point of use, but a
 * fire-and-forget call — `void Store.upsert(x)` — would otherwise fail in
 * silence, which is the exact failure this whole migration exists to remove: a
 * screen that looks like it saved and did not.
 *
 * This is a safety net, not a substitute for handling an error where it
 * matters. A save whose failure has a specific consequence should still say so
 * itself; this catches the ones that slip through, so nothing fails invisibly.
 */

import { toast } from "@/components/ui/use-toast";

let installed = false;

/** Errors that are noise rather than a failed write. */
function isIgnorable(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return (
    // Navigating away cancels in-flight requests; that is not a failure.
    /AbortError|The user aborted|Failed to fetch|NetworkError when attempting/i.test(message) ||
    message.trim() === ""
  );
}

export function installFailureReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (isIgnorable(reason)) return;

    const message = reason instanceof Error ? reason.message : String(reason);
    toast({
      title: "Something did not save",
      description: message.slice(0, 200),
      variant: "destructive",
    });

    // Still logged: the toast is for the user, the console entry is for
    // whoever has to work out why.
    console.error("Unhandled rejection:", reason);
  });
}
