import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { auditLeaveDays, applyCorrections, type CorrectionReport } from "@/lib/leaveRecalculation";
import { useCache } from "@/lib/collectionCache";
import { leavesCache } from "@/lib/hrmLeaveStore";
import { leaveBalancesCache } from "@/lib/leaveBalanceStore";

/**
 * Surfaces leave requests costed against the old holiday list, which counted
 * every public holiday after 2025 as a working day.
 *
 * Renders nothing when there is nothing to correct, so it disappears once the
 * correction has been applied rather than becoming permanent furniture.
 */
export function LeaveRecalculationNotice({ canApply }: { canApply: boolean }) {
  const [report, setReport] = useState<CorrectionReport | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // The audit reads the leave and balance caches, which load asynchronously.
  // Auditing only on mount would have run against empty caches, found nothing
  // to correct, and never looked again — so the banner would never appear.
  const { rows: leaveRows } = useCache(leavesCache);
  const { rows: balanceRows } = useCache(leaveBalancesCache);

  const refresh = useCallback(() => setReport(auditLeaveDays()), []);

  useEffect(() => {
    refresh();
    window.addEventListener("hrm.leave-changed", refresh);
    return () => window.removeEventListener("hrm.leave-changed", refresh);
  }, [refresh, leaveRows, balanceRows]);

  const overcharged = useMemo(
    () => report?.corrections.filter((c) => c.difference > 0) ?? [],
    [report],
  );

  if (!report || report.corrections.length === 0) return null;

  const apply = async () => {
    setApplying(true);
    try {
      const result = await applyCorrections(report);
      toast({
        title: "Leave recalculated",
        description:
          `${result.leavesUpdated} request${result.leavesUpdated === 1 ? "" : "s"} corrected` +
          (result.daysCredited > 0
            ? `, ${result.daysCredited} day${result.daysCredited === 1 ? "" : "s"} credited back to ${result.employeesCredited} employee${result.employeesCredited === 1 ? "" : "s"}.`
            : "."),
      });
      setOpen(false);
      refresh();
    } catch (err) {
      toast({
        title: "Could not apply corrections",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning-soft px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {report.corrections.length} leave request{report.corrections.length === 1 ? " was" : "s were"} costed
            against the old holiday calendar
          </p>
          <p className="text-xs text-muted-foreground">
            Public holidays after 2025 were counted as working days.
            {report.totalDaysOwed > 0 &&
              ` ${report.totalDaysOwed} day${report.totalDaysOwed === 1 ? "" : "s"} owed back across ${report.employeesAffected} employee${report.employeesAffected === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Review
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Recalculate leave days</DialogTitle>
            <DialogDescription>
              These requests were costed before the holiday calendar was fixed. Nothing has been
              changed yet.
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-subtle max-h-[45vh] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-raised">
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Employee</th>
                  <th className="px-3 py-2 text-left font-medium">Dates</th>
                  <th className="px-3 py-2 text-left font-medium">Holiday counted</th>
                  <th className="px-3 py-2 text-right font-medium">Charged</th>
                  <th className="px-3 py-2 text-right font-medium">Correct</th>
                  <th className="px-3 py-2 text-right font-medium">Owed</th>
                </tr>
              </thead>
              <tbody>
                {report.corrections.map((c) => (
                  <tr key={c.leave.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.leave.employee}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.leave.type} · {c.leave.status}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(c.leave.startDate).toLocaleDateString()} –{" "}
                      {new Date(c.leave.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.missedHolidays.length
                        ? c.missedHolidays.map((h) => h.name).join(", ")
                        : "—"}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{c.storedDays}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{c.correctDays}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {c.difference > 0 ? (
                        <span className="font-medium text-success">+{c.difference}</span>
                      ) : (
                        <span className="text-danger">{c.difference}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>
              Day counts are corrected on every request. Balances are only credited for approved
              leave, since pending and rejected requests never moved one.
            </p>
            {report.clampedBalances.length > 0 && (
              <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-danger">
                {report.clampedBalances.length} balance
                {report.clampedBalances.length === 1 ? "" : "s"} already sit at zero
                {" "}({report.clampedBalances.map((b) => `${b.employeeName} · ${b.leaveType}`).join("; ")}).
                Deductions stop at zero, so the days lost past that point cannot be worked out
                automatically — set those manually after applying.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void apply()} disabled={!canApply || applying}>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              {applying ? "Applying…" : `Correct ${report.corrections.length} request${report.corrections.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
          {!canApply && (
            <p className="text-xs text-muted-foreground">
              You need full access to leave management to apply these corrections.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
