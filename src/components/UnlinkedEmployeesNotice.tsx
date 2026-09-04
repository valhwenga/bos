import { UserRoundX } from "lucide-react";
import { useCache } from "@/lib/collectionCache";
import { employeesCache } from "@/lib/hrmStore";

/**
 * Warns when employee records have no login attached.
 *
 * Leave requests and balances are filtered by that link, so an unlinked
 * employee cannot see their own leave. The consequence is invisible from the
 * employee's side — they just see an empty page — so it has to be surfaced to
 * whoever can fix it.
 *
 * Renders nothing when everyone is linked.
 */
export function UnlinkedEmployeesNotice() {
  const { rows: employees, loading } = useCache(employeesCache);
  if (loading) return null;

  const unlinked = employees.filter((e) => !e.profileId);
  if (unlinked.length === 0) return null;

  const names = unlinked.slice(0, 6).map((e) => e.name).join(", ");
  const rest = unlinked.length - Math.min(unlinked.length, 6);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border border-warning/30 bg-warning-soft px-4 py-3">
      <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          {unlinked.length} employee{unlinked.length === 1 ? " has" : "s have"} no linked login
        </p>
        <p className="text-xs text-muted-foreground">
          {names}
          {rest > 0 ? ` and ${rest} more` : ""}. They cannot see their own leave or balance until
          an account is linked on their record — the page will simply look empty to them. Edit the
          employee and set the linked login under System Access.
        </p>
      </div>
    </div>
  );
}
