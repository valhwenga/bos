import { useEffect, useState } from "react";
import { AuditLogStore, type AuditLog } from "@/lib/auditLogStore";
import { Input } from "@/components/ui/input";

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>(AuditLogStore.list());
  const [q, setQ] = useState("");
  useEffect(()=>{ setLogs(AuditLogStore.list()); }, []);

  const filtered = logs.filter(l => {
    const hay = `${l.actor} ${l.entity} ${l.entityId||''} ${l.action} ${l.details||''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Dashboard</span>
          <span>›</span>
          <span>Users</span>
          <span>›</span>
          <span>Audit Logs</span>
        </div>
      </div>

      <div className="mb-4">
        <Input placeholder="Search logs by actor, entity, action..." value={q} onChange={(e)=> setQ(e.target.value)} className="w-full md:w-96" />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">TIME</th>
                <th className="text-left p-4 font-semibold text-sm">ACTOR</th>
                <th className="text-left p-4 font-semibold text-sm">ENTITY</th>
                <th className="text-left p-4 font-semibold text-sm">ACTION</th>
                <th className="text-left p-4 font-semibold text-sm">DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-4 text-sm">{new Date(l.ts).toLocaleString()}</td>
                  <td className="p-4 text-sm">{l.actor}</td>
                  <td className="p-4 text-sm">{l.entity}{l.entityId ? ` (${l.entityId})` : ''}</td>
                  <td className="p-4 text-sm capitalize">{l.action}</td>
                  <td className="p-4 text-sm">{l.details || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-sm text-muted-foreground" colSpan={5}>No logs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
