/**
 * The audit trail.
 *
 * There were three screens for this and none of them was routed, so the trail
 * could not be read at all. Two of them are gone; this one keeps the filters
 * and the CSV export that the compliance report had, and reads the rows from
 * Postgres rather than from whichever of two localStorage writers went last.
 */

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AuditLogStore, auditCache, auditCsv, type AuditLog, type AuditAction } from "@/lib/auditLogStore";
import { useCache } from "@/lib/collectionCache";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Destructive and authentication events should be findable at a glance. */
const ACTION_TONE: Record<AuditAction, string> = {
  create: "bg-success-soft text-success",
  update: "bg-info-soft text-info",
  delete: "bg-danger-soft text-danger",
  approve: "bg-success-soft text-success",
  reject: "bg-danger-soft text-danger",
  login: "bg-muted text-muted-foreground",
  logout: "bg-muted text-muted-foreground",
  export: "bg-warning-soft text-warning",
};

const ACTIONS: AuditAction[] = [
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "login",
  "logout",
  "export",
];

const AuditLogs = () => {
  const { loading, error } = useCache(auditCache);
  const logs = AuditLogStore.list();

  const [action, setAction] = useState<AuditAction | "all">("all");
  const [entity, setEntity] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /** Entity kinds actually present, rather than a list that guesses. */
  const entities = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entity))).sort(),
    [logs],
  );

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (action !== "all" && l.action !== action) return false;
        if (entity !== "all" && l.entity !== entity) return false;
        if (from && l.at < from) return false;
        // The bound is a date, so it has to cover the whole of that day.
        if (to && l.at > `${to}T23:59:59.999Z`) return false;
        return true;
      }),
    [logs, action, entity, from, to],
  );

  const exportCsv = () => {
    const blob = new Blob([auditCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Exporting the trail is itself an audited action.
    void AuditLogStore.append({
      entity: "audit_log",
      action: "export",
      details: `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`,
    });
  };

  const columns: Column<AuditLog>[] = [
    {
      id: "at",
      header: "Time",
      sortValue: (l) => l.at,
      cell: (l) => (
        <span className="whitespace-nowrap text-muted-foreground">{new Date(l.at).toLocaleString()}</span>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      sortValue: (l) => l.actorName,
      cell: (l) => (
        <div className="flex flex-col">
          <span className="font-medium">{l.actorName}</span>
          {l.actorEmail && <span className="text-xs text-muted-foreground">{l.actorEmail}</span>}
        </div>
      ),
    },
    {
      id: "entity",
      header: "Entity",
      sortValue: (l) => l.entity,
      cell: (l) => (
        <span>
          {l.entity}
          {l.entityId && <span className="ml-1 font-mono text-xs text-subtle">{l.entityId}</span>}
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      sortValue: (l) => l.action,
      cell: (l) => (
        <span
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${
            ACTION_TONE[l.action] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {l.action}
        </span>
      ),
    },
    {
      id: "details",
      header: "Details",
      hideOnMobile: true,
      cell: (l) => (
        <span className="block max-w-md truncate text-muted-foreground" title={l.details}>
          {l.details || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Audit logs"
        description="A record of who changed what, and when. Entries cannot be edited or removed."
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: "Audit logs" }]}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          Could not load the audit log: {error.message}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Action</label>
          <Select value={action} onValueChange={(v) => setAction(v as AuditAction | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a} className="capitalize">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Entity</label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        {(action !== "all" || entity !== "all" || from || to) && (
          <Button
            variant="ghost"
            onClick={() => {
              setAction("all");
              setEntity("all");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(l) => l.id}
        searchAccessor={(l) =>
          `${l.actorName} ${l.actorEmail ?? ""} ${l.entity} ${l.entityId ?? ""} ${l.action} ${l.details ?? ""}`
        }
        searchPlaceholder="Search by actor, entity or action…"
        pageSize={50}
        empty={{
          title: loading ? "Loading…" : "No activity recorded",
          description: loading
            ? "Reading the trail."
            : "Actions taken in the system will be listed here as they happen.",
        }}
      />
    </div>
  );
};

export default AuditLogs;
