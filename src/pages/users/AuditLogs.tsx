import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { AuditLogStore, type AuditLog, type AuditAction } from "@/lib/auditLogStore";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

/** Destructive and authentication events should be findable at a glance. */
const ACTION_TONE: Record<AuditAction, string> = {
  create: "bg-success-soft text-success",
  update: "bg-info-soft text-info",
  delete: "bg-danger-soft text-danger",
  login: "bg-muted text-muted-foreground",
  logout: "bg-muted text-muted-foreground",
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>(AuditLogStore.list());

  useEffect(() => {
    const refresh = () => setLogs(AuditLogStore.list());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      id: "ts",
      header: "Time",
      sortValue: (l) => l.ts,
      cell: (l) => <span className="whitespace-nowrap text-muted-foreground">{new Date(l.ts).toLocaleString()}</span>,
    },
    { id: "actor", header: "Actor", sortValue: (l) => l.actor, cell: (l) => <span className="font-medium">{l.actor}</span> },
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
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${ACTION_TONE[l.action] ?? "bg-muted text-muted-foreground"}`}>
          {l.action}
        </span>
      ),
    },
    {
      id: "details",
      header: "Details",
      hideOnMobile: true,
      cell: (l) => <span className="block max-w-md truncate text-muted-foreground" title={l.details}>{l.details || "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Audit logs"
        description="A record of who changed what, and when."
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: "Audit logs" }]}
      />

      <DataTable
        rows={logs}
        columns={columns}
        rowKey={(l) => l.id}
        searchAccessor={(l) => `${l.actor} ${l.entity} ${l.entityId ?? ""} ${l.action} ${l.details ?? ""}`}
        searchPlaceholder="Search by actor, entity or action…"
        pageSize={50}
        empty={{
          title: "No activity recorded",
          description: "Actions taken in the system will be listed here as they happen.",
        }}
      />
    </div>
  );
};

export default AuditLogs;
