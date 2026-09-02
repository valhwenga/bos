import { AuditReport } from "@/components/AuditReport";
import { canAccess } from "@/lib/accessControl";

export default function AuditLogs() {
  // This read the role straight out of localStorage, which the user could edit,
  // and hardcoded two role ids — so a custom administrative role was refused
  // while anyone willing to type one line was let in. Audit logs are a settings
  // concern, so ask the same question the rest of the app asks.
  const canView = canAccess("settings", "full");

  if (!canView) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You do not have permission to view audit logs.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Audit & Compliance</h1>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Dashboard</span>
          <span>›</span>
          <span>Settings</span>
          <span>›</span>
          <span className="text-foreground">Audit Logs</span>
        </div>
      </div>
      <AuditReport />
    </div>
  );
}
