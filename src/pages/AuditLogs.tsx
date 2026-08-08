import { AuthStore } from "@/lib/authStore";
import { AuditReport } from "@/components/AuditReport";

export default function AuditLogs() {
  const roleId = AuthStore.currentSession()?.userId ? localStorage.getItem('auth.roleId') ?? "" : "";
  const canView = ["role_super_admin", "role_company_admin"].includes(roleId);

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
        <h1 className="text-3xl font-bold mb-2">Audit & Compliance</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Dashboard</span>
          <span>›</span>
          <span>Settings</span>
          <span>›</span>
          <span className="text-primary">Audit Logs</span>
        </div>
      </div>
      <AuditReport />
    </div>
  );
}
