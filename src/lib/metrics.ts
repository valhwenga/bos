import { getCurrentRole } from "./accessControl";
import { UserStore } from "./userStore";
import { HRMStore } from "./hrmStore";
import { HRMDepartmentsStore } from "./hrmDepartmentsStore";
import { SupportStore, type Ticket } from "./supportStore";
import { CRMStore } from "./crmStore";
import { ProjectStore } from "./projectStore";
import { AccountingStore } from "./accountingStore";
import { useEffect, useMemo, useState } from "react";

export type DashboardMetrics = {
  employees: number;
  departments: number;
  ticketsOpen: number;
  ticketsOverdue: number;
  ticketsSlaRate: number; // 0-100
  projects: number;
  deals: number;
  invoices: number;
};

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function scopeDepartmentIds(): string[] | undefined {
  const role = getCurrentRole();
  const user = UserStore.get() as any;
  // If user has explicit managedDepartmentIds, use them. Otherwise fallback to their own department if present.
  const managed: string[] | undefined = user?.managedDepartmentIds;
  const ownDeptId: string | undefined = user?.departmentId;

  if (role.level === "Global" || role.level === "Company") return undefined; // no scoping
  if (managed && managed.length) return unique(managed);
  if (ownDeptId) return [ownDeptId];
  return undefined; // if no info, default to all for now
}

function filterByDepartments<T extends { departmentId?: string }>(list: T[], deptIds?: string[]): T[] {
  if (!deptIds || deptIds.length === 0) return list;
  return list.filter((x) => !x.departmentId || deptIds.includes(x.departmentId));
}

export function computeMetrics(): DashboardMetrics {
  const deptIds = scopeDepartmentIds();

  const employeesAll = HRMStore.list();
  const employees = filterByDepartments(employeesAll, deptIds);

  const departments = HRMDepartmentsStore.list();
  const ticketsAll: Ticket[] = SupportStore.list();
  const tickets: Ticket[] = filterByDepartments<Ticket>(ticketsAll, deptIds);

  const overdue = tickets.filter(
    (t) => t.dueAt && (!t.resolvedAt || new Date(t.resolvedAt) > new Date(t.dueAt!))
  ).length;
  const withSla = tickets.filter((t) => t.dueAt).length;
  const slaHit = tickets.filter(
    (t) => t.dueAt && t.resolvedAt && new Date(t.resolvedAt) <= new Date(t.dueAt)
  ).length;
  const slaRate = withSla ? Math.round((slaHit / withSla) * 100) : 100;

  const projects = ProjectStore.listProjects().length;
  const deals = CRMStore.list().length;
  const invoices = AccountingStore.listInvoices().length;

  return {
    employees: employees.length,
    departments: departments.length,
    ticketsOpen: tickets.filter((t) => t.status === "open").length,
    ticketsOverdue: overdue,
    ticketsSlaRate: slaRate,
    projects,
    deals,
    invoices,
  };
}

export function useDashboardMetrics(): DashboardMetrics {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // Any of our modules updating should trigger a recompute
      if (
        e.key.startsWith("hrm.") ||
        e.key.startsWith("support.") ||
        e.key.startsWith("proj.") ||
        e.key.startsWith("crm.") ||
        e.key.startsWith("acct.") ||
        e.key.startsWith("user.") ||
        e.key.startsWith("auth.")
      ) {
        setTick((x) => x + 1);
      }
    };
    window.addEventListener("storage", onStorage);

    const id = window.setInterval(() => setTick((x) => x + 1), 5000);
    const onFocus = () => setTick((x) => x + 1);
    window.addEventListener("focus", onFocus);
    const onProfile = () => setTick((x) => x + 1);
    window.addEventListener("user-profile-changed", onProfile as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("user-profile-changed", onProfile as any);
      window.clearInterval(id);
    };
  }, []);

  // recompute when tick changes
  return useMemo(() => computeMetrics(), [tick]);
}
