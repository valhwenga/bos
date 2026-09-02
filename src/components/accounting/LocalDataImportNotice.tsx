import { useEffect, useState } from "react";
import { Database, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  archiveLocalData,
  findLocalData,
  hasLocalData,
  importLocalData,
  totalLocalRecords,
  type ImportCounts,
  type ImportReport,
} from "@/lib/importLocalData";
import { invoicesCache, quotationsCache } from "@/lib/accountingStore";
import { paymentsCache } from "@/lib/paymentStore";
import { customersCache } from "@/lib/customersStore";
import { productsCache } from "@/lib/productsStore";
import { expensesCache } from "@/lib/expenseStore";
import { salesCache } from "@/lib/salesStore";
import { creditNotesCache } from "@/lib/creditNotesStore";
import { recurringCache } from "@/lib/recurringStore";

/**
 * Offers to copy accounting data left in this browser into the database.
 *
 * Renders nothing when there is none, so it disappears after the import rather
 * than becoming permanent furniture.
 */
export function LocalDataImportNotice({ canImport }: { canImport: boolean }) {
  const [present, setPresent] = useState(false);
  const [counts, setCounts] = useState(findLocalData());
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    setPresent(hasLocalData());
    setCounts(findLocalData());
  }, []);

  if (!present) return null;

  const total = totalLocalRecords(counts);

  // Rendered from the counts rather than a hand-written sentence, so a store
  // added to the import cannot be silently left out of what the user is told.
  const LABELS: Record<keyof ImportCounts, string> = {
    customers: "customer",
    products: "product",
    quotations: "quotation",
    invoices: "invoice",
    payments: "payment",
    expenses: "expense",
    sales: "sale",
    creditNotes: "credit note",
    recurring: "recurring template",
    departments: "department",
    employees: "employee",
    leaves: "leave request",
    payroll: "payroll entry",
    leaveBalances: "leave balance",
  };
  const describe = (c: ImportCounts) =>
    (Object.keys(LABELS) as (keyof ImportCounts)[])
      .filter((k) => c[k] > 0)
      .map((k) => `${c[k]} ${LABELS[k]}${c[k] === 1 ? "" : "s"}`)
      .join(", ");

  const run = async () => {
    setRunning(true);
    try {
      const result = await importLocalData();
      setReport(result);
      await Promise.all([
        quotationsCache.refresh(),
        invoicesCache.refresh(),
        paymentsCache.refresh(),
        customersCache.refresh(),
        productsCache.refresh(),
        expensesCache.refresh(),
        salesCache.refresh(),
        creditNotesCache.refresh(),
        recurringCache.refresh(),
      ]);
      const moved = totalLocalRecords(result.imported);
      toast({
        title: result.failures.length ? "Imported with problems" : "Import complete",
        description: result.failures.length
          ? `${moved} record(s) imported, ${result.failures.length} could not be.`
          : `${moved} record(s) are now in the database.`,
        variant: result.failures.length ? "destructive" : undefined,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const finish = () => {
    archiveLocalData();
    setPresent(false);
    toast({
      title: "Local copy set aside",
      description: "It is kept in this browser under a dated key, not deleted.",
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Database className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {total} record{total === 1 ? "" : "s"} in this browser are not in the database
          </p>
          <p className="text-xs text-muted-foreground">
            {describe(counts)}. Until they are imported only this browser can see them, and
            clearing it would lose them.
          </p>
        </div>
        {report ? (
          <Button size="sm" variant="outline" onClick={finish}>
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            Done, set the local copy aside
          </Button>
        ) : (
          <Button size="sm" onClick={() => void run()} disabled={!canImport || running}>
            {running ? "Importing…" : "Import into the database"}
          </Button>
        )}
      </div>

      {report && (
        <div className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs">
          <p className="text-foreground">Imported {describe(report.imported) || "nothing"}.</p>
          {report.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-danger">
              {report.failures.slice(0, 8).map((f) => (
                <li key={`${f.kind}-${f.id}`}>
                  {f.kind.slice(0, -1)} {f.label}: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!canImport && (
        <p className="text-xs text-muted-foreground">
          You need edit access to accounting to import these.
        </p>
      )}
    </div>
  );
}
