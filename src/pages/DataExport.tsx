/**
 * Take a copy of the company's data.
 *
 * This screen was "System Backup & Restore". It promised more than a browser
 * can deliver — see dataExport.ts for what each of its buttons actually did —
 * so it offers the one thing that is genuinely useful and honest: a file you
 * can keep, and a clear statement of where the real backups are.
 */

import { useState } from "react";
import { Download, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import {
  EXPORT_GROUPS,
  exportData,
  downloadExport,
  formatBytes,
  type ExportSummary,
} from "@/lib/dataExport";

const DataExport = () => {
  const [selected, setSelected] = useState<string[]>(EXPORT_GROUPS.map((g) => g.label));
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [size, setSize] = useState(0);

  const toggle = (label: string) =>
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const run = async () => {
    setBusy(true);
    try {
      const result = await exportData(selected);
      downloadExport(result);
      setSummary(result.summary);
      setSize(new Blob([result.json]).size);
      toast({
        title: "Export downloaded",
        description: `${result.summary.totalRows.toLocaleString()} rows.`,
      });
    } catch (err: unknown) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not read the data.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const excluded = summary?.tables.filter((t) => t.excluded) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Export data"
        description="Download a copy of the company's records to keep off the system."
        breadcrumbs={[{ label: "Settings", to: "/settings/company" }, { label: "Export data" }]}
        actions={
          <Button onClick={() => void run()} disabled={busy || selected.length === 0}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy ? "Reading…" : "Export"}
          </Button>
        }
      />

      <Card className="border-info/40 bg-info-soft">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-info">This is a copy, not a backup you can restore from.</p>
            <p className="text-muted-foreground">
              Restoring the system is a database operation — a Postgres restore or point-in-time
              recovery on the Supabase project, covered in DEPLOYMENT.md. Use this to keep an
              independent copy, to move data elsewhere, or to answer a question about what the
              records held on a given day.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What to include</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {EXPORT_GROUPS.map((group) => (
            <label
              key={group.label}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-surface-raised"
            >
              <Checkbox
                checked={selected.includes(group.label)}
                onCheckedChange={() => toggle(group.label)}
                aria-label={group.label}
              />
              <span>
                <span className="block text-sm font-medium">{group.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {group.tables.length} tables
                </span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        An export contains what your own role is allowed to read. Permissions are checked before each
        table is read — a table your role cannot see is listed as excluded, because reading it would
        return nothing and look identical to a table with no data in it.
      </p>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Last export — {summary.totalRows.toLocaleString()} rows, {formatBytes(size)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {excluded.length > 0 && (
              <div className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {excluded.length} {excluded.length === 1 ? "table was" : "tables were"} not included.
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {excluded.map((t) => (
                      <li key={t.table}>
                        <span className="font-mono">{t.table}</span> — {t.excluded}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {summary.tables
                .filter((t) => !t.excluded)
                .map((t) => (
                  <div key={t.table} className="flex justify-between gap-2 border-b py-1 last:border-0">
                    <span className="font-mono text-xs text-muted-foreground">{t.table}</span>
                    <span className="tabular-nums">{t.rows.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataExport;
