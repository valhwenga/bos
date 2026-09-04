/**
 * Exports the company's data as a file.
 *
 * This replaces a "Backup & Restore" panel that could not do either.
 *
 * It kept its backups in localStorage — the thing it was backing up — and each
 * snapshot copied every key including the one holding the previous snapshots,
 * so the store doubled every time. Measured on an almost-empty browser: 3KB,
 * 9KB, 21KB, 45KB, 93KB for five backups. With real data it reaches the ~5MB
 * origin quota within a handful, and `create()` had no try/catch around the
 * write that would then throw.
 *
 * Restore called `localStorage.clear()` first, which also cleared the backups
 * and the signed-in session. Import parsed the uploaded file and then looked
 * its timestamp up in the *local* list, where it could not be — so importing a
 * colleague's file did nothing at all and reported "Import Successful". The
 * schedule with its daily/weekly/monthly options was stored and never read by
 * anything.
 *
 * None of that could have worked anyway, because the data is in Postgres now.
 * Restoring a database is `pg_restore` or point-in-time recovery, not a button
 * in a browser. What a browser can usefully do is hand you a copy to keep, so
 * that is all this does.
 *
 * The export contains what the person running it is allowed to read, and says
 * plainly which tables it left out and why.
 */

import { supabase } from "./supabase";
import { AuditLogStore } from "./auditLogStore";
import { canAccess } from "./accessControl";
import type { ModuleKey } from "./modules";

/**
 * The tables worth keeping a copy of, each with the module that governs it.
 *
 * Deliberately not every table in the schema. `attachments` and
 * `document_sequences` describe files and counters that mean nothing without
 * the storage bucket and the live database; `notifications`, `messages` and
 * `conversation_members` are correspondence that belongs to individuals rather
 * than to the company, and exporting them here would hand one person a copy of
 * everyone's.
 *
 * The module is recorded because row level security *filters* a select rather
 * than refusing it: a role with no payroll access reads `payroll_entries` and
 * gets zero rows and no error, which is indistinguishable from a company that
 * has not run payroll. Checking access first is what lets the summary say "not
 * included" instead of quietly reporting nothing.
 */
export type ExportTable = { table: string; module: ModuleKey };

export const EXPORT_GROUPS: { label: string; tables: ExportTable[] }[] = [
  {
    label: "Accounting",
    tables: [
      { table: "invoices", module: "accounting" },
      { table: "quotations", module: "accounting" },
      { table: "line_items", module: "accounting" },
      { table: "payments", module: "accounting" },
      { table: "credit_notes", module: "accounting" },
      { table: "credit_note_applications", module: "accounting" },
      { table: "expenses", module: "accounting" },
      { table: "customers", module: "accounting" },
      { table: "products", module: "inventory" },
      { table: "sales", module: "accounting" },
      { table: "recurring_templates", module: "accounting" },
      { table: "recurring_runs", module: "accounting" },
    ],
  },
  {
    label: "People",
    tables: [
      { table: "employees", module: "hrm.employees" },
      { table: "departments", module: "hrm.departments" },
      { table: "leave_requests", module: "hrm.leave" },
      { table: "leave_balances", module: "hrm.leave" },
      { table: "payroll_entries", module: "hrm.payroll" },
      { table: "performance_reviews", module: "hrm.performance" },
      { table: "attendance_entries", module: "hrm.attendance" },
      { table: "employee_bank_details", module: "hrm.payroll" },
    ],
  },
  {
    label: "Projects",
    tables: [
      { table: "projects", module: "projects" },
      { table: "project_tasks", module: "projects" },
      { table: "project_types", module: "projects" },
      { table: "project_bugs", module: "projects" },
      { table: "time_entries", module: "projects" },
      { table: "calendar_events", module: "projects" },
    ],
  },
  {
    label: "Customers and support",
    tables: [
      { table: "clients", module: "support" },
      { table: "leads", module: "crm" },
      { table: "deals", module: "crm" },
      { table: "crm_customers", module: "crm" },
      { table: "crm_tasks", module: "crm" },
      { table: "tickets", module: "support" },
      { table: "support_settings", module: "support" },
      { table: "canned_responses", module: "support" },
    ],
  },
  {
    label: "Configuration and history",
    tables: [
      { table: "company_settings", module: "settings" },
      { table: "roles", module: "settings" },
      { table: "role_access", module: "settings" },
      { table: "profiles", module: "settings" },
      { table: "audit_log", module: "settings" },
      { table: "email_messages", module: "email" },
    ],
  },
];

export type ExportSummary = {
  takenAt: string;
  tables: { table: string; rows: number; excluded?: string }[];
  totalRows: number;
};

export type ExportResult = { summary: ExportSummary; json: string };

/**
 * Reads every table in the chosen groups.
 *
 * A table that is unreadable is recorded rather than aborting the export: a
 * role without payroll access should still be able to take a copy of the
 * invoices, and the summary makes the gap explicit instead of producing a file
 * that quietly lacks a section.
 */
export async function exportData(groups: string[] = EXPORT_GROUPS.map((g) => g.label)): Promise<ExportResult> {
  const tables = EXPORT_GROUPS.filter((g) => groups.includes(g.label)).flatMap((g) => g.tables);

  const data: Record<string, unknown[]> = {};
  const summary: ExportSummary = { takenAt: new Date().toISOString(), tables: [], totalRows: 0 };

  for (const { table, module } of tables) {
    // Asked before reading, because the read itself cannot tell us: row level
    // security returns an empty result, not a refusal.
    if (!canAccess(module, "view")) {
      summary.tables.push({ table, rows: 0, excluded: `your role has no access to ${module}` });
      continue;
    }
    const { data: rows, error } = await supabase.from(table).select("*");
    if (error) {
      summary.tables.push({ table, rows: 0, excluded: error.message });
      continue;
    }
    data[table] = rows ?? [];
    summary.tables.push({ table, rows: rows?.length ?? 0 });
    summary.totalRows += rows?.length ?? 0;
  }

  const json = JSON.stringify(
    {
      // Named so a file found in a downloads folder in two years is
      // identifiable without opening it.
      format: "bos-data-export",
      version: 1,
      takenAt: summary.takenAt,
      note:
        "A copy of the data readable by whoever exported it. This is not a " +
        "restorable backup: restoring the system is a database operation " +
        "(pg_restore or point-in-time recovery). See DEPLOYMENT.md.",
      tables: summary.tables,
      data,
    },
    null,
    2,
  );

  // Taking a copy of the company's data off the system is worth recording.
  void AuditLogStore.append({
    entity: "data_export",
    action: "export",
    details: `${summary.totalRows} rows from ${summary.tables.filter((t) => !t.excluded).length} tables`,
  });

  return { summary, json };
}

/** Hands the export to the browser as a download. */
export function downloadExport(result: ExportResult): void {
  const blob = new Blob([result.json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bos-export-${result.summary.takenAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Clears what the old panel left in this browser.
 *
 * Those snapshots can be megabytes of stale duplicates sitting in a quota the
 * app still needs for the few things it legitimately keeps locally.
 */
export function clearLegacyBackups(): void {
  try {
    localStorage.removeItem("system_backups");
    localStorage.removeItem("backup_schedule");
  } catch {
    void 0;
  }
}
