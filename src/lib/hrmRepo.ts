/**
 * Postgres reads and writes for HR and payroll.
 *
 * This is the most sensitive data in the system — salaries, deductions, leave
 * records, national ID numbers — and it was held in localStorage, meaning it
 * existed only on whichever machine last touched it and was readable by
 * anything running in that browser. It is now rows behind row level security,
 * where hrm.payroll access is what decides who can see a salary.
 *
 * As with accounting, the app's types are unchanged and rows carry their
 * original id in `legacy_id`, so existing links keep resolving.
 */

import { supabase } from "./supabase";
import type { Employee } from "./hrmStore";
import type { Department } from "./hrmDepartmentsStore";
import type { Leave, LeaveStatus } from "./hrmLeaveStore";
import type { PayrollEntry } from "./payrollStore";
import type { LeaveBalances } from "./leaveBalanceStore";

const appId = (row: { id: string; legacy_id: string | null }) => row.legacy_id ?? row.id;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const idFilter = (v: string): [string, string] => (isUuid(v) ? ["id", v] : ["legacy_id", v]);

const toIso = (d: string | null): string | undefined => (d ? new Date(d).toISOString() : undefined);
const toDate = (iso: string | undefined | null): string | null =>
  iso ? new Date(iso).toISOString().slice(0, 10) : null;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Maps database uuids back to the ids the app uses. */
async function appIdMap(table: string): Promise<Map<string, string>> {
  const { data } = await supabase.from(table).select("id, legacy_id");
  const m = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; legacy_id: string | null }[]) {
    m.set(r.id, r.legacy_id ?? r.id);
  }
  return m;
}

async function uuidFor(table: string, id: string): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq(...idFilter(id))
    .maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

type DepartmentRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  head: string | null;
  description: string | null;
  color: string | null;
};

export const DepartmentRepo = {
  async list(): Promise<Department[]> {
    const { data, error } = await supabase
      .from("departments")
      .select("id, legacy_id, name, head, description, color")
      .order("name");
    if (error) throw new Error(error.message);
    return (data as DepartmentRow[]).map((row) => ({
      id: appId(row),
      name: row.name,
      head: row.head ?? undefined,
      description: row.description ?? undefined,
      color: row.color ?? undefined,
    })) as Department[];
  },

  async upsert(d: Department): Promise<Department> {
    const payload = {
      name: d.name,
      head: d.head ?? null,
      description: d.description ?? null,
      color: d.color ?? null,
    };
    const existing = await uuidFor("departments", d.id);
    if (existing) {
      const { error } = await supabase.from("departments").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ ...payload, legacy_id: isUuid(d.id) ? null : d.id });
      if (error) throw new Error(error.message);
    }
    return d;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("departments").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

type EmployeeRow = {
  id: string;
  legacy_id: string | null;
  profile_id: string | null;
  employee_no: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  designation: string | null;
  joining_date: string | null;
  salary: number | string | null;
  status: string | null;
  date_of_birth: string | null;
  address: string | null;
  marital_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  national_id: string | null;
};

const EMPLOYEE_COLUMNS =
  "id, legacy_id, profile_id, employee_no, name, email, phone, department_id, designation, joining_date, salary, status, date_of_birth, address, marital_status, emergency_contact_name, emergency_contact_phone, national_id";

export const EmployeeRepo = {
  async list(): Promise<Employee[]> {
    const [{ data, error }, departmentIds] = await Promise.all([
      supabase.from("employees").select(EMPLOYEE_COLUMNS).order("name"),
      appIdMap("departments"),
    ]);
    if (error) throw new Error(error.message);

    return (data as EmployeeRow[]).map((row) => ({
      id: appId(row),
      profileId: row.profile_id ?? undefined,
      name: row.name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      departmentId: row.department_id
        ? departmentIds.get(row.department_id) ?? row.department_id
        : undefined,
      designation: row.designation ?? undefined,
      joiningDate: row.joining_date ?? undefined,
      // The app carries salary as a string, because the field is free text.
      salary: row.salary === null ? undefined : String(row.salary),
      status: row.status ?? undefined,
      dob: row.date_of_birth ?? undefined,
      address: row.address ?? undefined,
      maritalStatus: row.marital_status ?? undefined,
      emergencyContactName: row.emergency_contact_name ?? undefined,
      emergencyContactPhone: row.emergency_contact_phone ?? undefined,
      nationalId: row.national_id ?? undefined,
      // Documents are not carried here; they belong in the employee-documents
      // storage bucket rather than as base64 blobs on the row.
    }));
  },

  async upsert(e: Employee): Promise<Employee> {
    const departmentUuid = e.departmentId ? await uuidFor("departments", e.departmentId) : null;

    // The app's salary field is free text; store what parses and nothing
    // otherwise, rather than writing NaN into a numeric column.
    const salary = e.salary === undefined || e.salary === "" ? null : Number(String(e.salary).replace(/[^0-9.-]/g, ""));

    const payload = {
      name: e.name,
      // The login this employee signs in with. It decides which leave rows they
      // can see, so it is a permission-bearing field, not a convenience.
      profile_id: e.profileId ?? null,
      email: e.email ?? null,
      phone: e.phone ?? null,
      department_id: departmentUuid,
      designation: e.designation ?? null,
      joining_date: e.joiningDate || null,
      salary: salary !== null && Number.isFinite(salary) ? salary : null,
      status: e.status ?? null,
      date_of_birth: e.dob || null,
      address: e.address ?? null,
      marital_status: e.maritalStatus ?? null,
      emergency_contact_name: e.emergencyContactName ?? null,
      emergency_contact_phone: e.emergencyContactPhone ?? null,
      national_id: e.nationalId ?? null,
    };

    const existing = await uuidFor("employees", e.id);
    if (existing) {
      const { error } = await supabase.from("employees").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("employees")
        .insert({ ...payload, legacy_id: isUuid(e.id) ? null : e.id });
      if (error) throw new Error(error.message);
    }
    return e;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("employees").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

type LeaveRow = {
  id: string;
  legacy_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number | string;
  reason: string | null;
  status: string;
  manager_note: string | null;
  applied_on: string | null;
};

const LEAVE_COLUMNS =
  "id, legacy_id, employee_id, employee_name, leave_type, start_date, end_date, days, reason, status, manager_note, applied_on";

export const LeaveRepo = {
  async list(): Promise<Leave[]> {
    const [{ data, error }, employeeIds] = await Promise.all([
      supabase.from("leave_requests").select(LEAVE_COLUMNS).order("applied_on", { ascending: false }),
      appIdMap("employees"),
    ]);
    if (error) throw new Error(error.message);

    return (data as LeaveRow[]).map((row) => ({
      id: appId(row),
      employee: row.employee_name ?? "",
      employeeId: row.employee_id ? employeeIds.get(row.employee_id) ?? row.employee_id : "",
      type: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: num(row.days),
      reason: row.reason ?? "",
      status: row.status as LeaveStatus,
      managerNote: row.manager_note ?? undefined,
      appliedOn: toIso(row.applied_on) ?? new Date().toISOString(),
    })) as Leave[];
  },

  async upsert(l: Leave): Promise<Leave> {
    const employeeUuid = l.employeeId ? await uuidFor("employees", l.employeeId) : null;

    const payload = {
      employee_id: employeeUuid,
      // Kept alongside the link so a request still names who took the leave if
      // the employee record is later removed.
      employee_name: l.employee ?? null,
      leave_type: l.type,
      start_date: toDate(l.startDate),
      end_date: toDate(l.endDate),
      days: l.days,
      reason: l.reason ?? null,
      status: l.status,
      manager_note: l.managerNote ?? null,
      applied_on: l.appliedOn ?? new Date().toISOString(),
    };

    const existing = await uuidFor("leave_requests", l.id);
    if (existing) {
      // requested_by is deliberately not in the update. It records who
      // submitted the request, and it is one of the things that lets that
      // person still see it; an approver saving a decision must not overwrite
      // it with their own id and take the employee's access away.
      const { error } = await supabase.from("leave_requests").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("leave_requests").insert({
        ...payload,
        legacy_id: isUuid(l.id) ? null : l.id,
        // Set once, on submission.
        requested_by: auth.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return l;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("leave_requests").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Leave balances
//
// Stored one row per employee and leave type, rather than the app's nested
// object, so a single balance can be updated without rewriting everyone's.
// ---------------------------------------------------------------------------

export const LeaveBalanceRepo = {
  async all(): Promise<LeaveBalances> {
    const [{ data, error }, employeeIds] = await Promise.all([
      supabase.from("leave_balances").select("employee_id, leave_type, balance_days"),
      appIdMap("employees"),
    ]);
    if (error) throw new Error(error.message);

    const out: LeaveBalances = {};
    for (const row of (data ?? []) as {
      employee_id: string;
      leave_type: string;
      balance_days: number | string;
    }[]) {
      const employee = employeeIds.get(row.employee_id) ?? row.employee_id;
      out[employee] ??= {};
      out[employee][row.leave_type] = num(row.balance_days);
    }
    return out;
  },

  /** Replaces every balance for one employee. */
  async setForEmployee(employeeId: string, balances: Record<string, number>): Promise<void> {
    const employeeUuid = await uuidFor("employees", employeeId);
    if (!employeeUuid) {
      throw new Error(`Employee ${employeeId} was not found, so the balance was not saved.`);
    }

    const { error: delError } = await supabase
      .from("leave_balances")
      .delete()
      .eq("employee_id", employeeUuid);
    if (delError) throw new Error(delError.message);

    const rows = Object.entries(balances).map(([leave_type, balance_days]) => ({
      employee_id: employeeUuid,
      leave_type,
      balance_days,
    }));
    if (rows.length === 0) return;

    const { error } = await supabase.from("leave_balances").insert(rows);
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

type PayrollRow = {
  id: string;
  legacy_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  department: string | null;
  period: string | null;
  basic_salary: number | string;
  allowances: PayrollEntry["allowances"] | null;
  deductions: PayrollEntry["deductions"] | null;
  overtime: PayrollEntry["overtime"] | null;
  net_salary: number | string;
  payment_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

const PAYROLL_COLUMNS =
  "id, legacy_id, employee_id, employee_name, department, period, basic_salary, allowances, deductions, overtime, net_salary, payment_date, status, notes, created_at";

const ZERO_ALLOWANCES = { housing: 0, transport: 0, medical: 0, bonus: 0, other: 0 };
const ZERO_DEDUCTIONS = { paye: 0, ui: 0, pension: 0, medical: 0, other: 0 };
const ZERO_OVERTIME = { hours: 0, rate: 0, amount: 0 };

export const PayrollRepo = {
  async list(): Promise<PayrollEntry[]> {
    const [{ data, error }, employeeIds] = await Promise.all([
      supabase.from("payroll_entries").select(PAYROLL_COLUMNS).order("payment_date", { ascending: false }),
      appIdMap("employees"),
    ]);
    if (error) throw new Error(error.message);

    return (data as PayrollRow[]).map((row) => ({
      id: appId(row),
      employeeId: row.employee_id ? employeeIds.get(row.employee_id) ?? row.employee_id : "",
      employee: row.employee_name ?? "",
      department: row.department ?? "",
      basicSalary: num(row.basic_salary),
      // A row saved before a field existed would otherwise arrive undefined and
      // turn every total that touches it into NaN.
      allowances: { ...ZERO_ALLOWANCES, ...(row.allowances ?? {}) },
      deductions: { ...ZERO_DEDUCTIONS, ...(row.deductions ?? {}) },
      overtime: { ...ZERO_OVERTIME, ...(row.overtime ?? {}) },
      netSalary: num(row.net_salary),
      paymentDate: row.payment_date ?? "",
      status: row.status as PayrollEntry["status"],
      createdAt: row.created_at,
      notes: row.notes ?? undefined,
    }));
  },

  async upsert(entry: PayrollEntry): Promise<PayrollEntry> {
    const employeeUuid = entry.employeeId ? await uuidFor("employees", entry.employeeId) : null;

    const payload = {
      employee_id: employeeUuid,
      employee_name: entry.employee ?? null,
      department: entry.department ?? null,
      // The schema keeps both: `period` is what the pay covers, `payment_date`
      // is when it is paid. The app only tracks the latter, so the period is
      // derived from it rather than left null.
      period: entry.paymentDate || null,
      payment_date: entry.paymentDate || null,
      basic_salary: entry.basicSalary,
      allowances: entry.allowances ?? ZERO_ALLOWANCES,
      deductions: entry.deductions ?? ZERO_DEDUCTIONS,
      overtime: entry.overtime ?? ZERO_OVERTIME,
      net_salary: entry.netSalary,
      status: entry.status,
      notes: entry.notes ?? null,
    };

    const existing = await uuidFor("payroll_entries", entry.id);
    if (existing) {
      const { error } = await supabase.from("payroll_entries").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("payroll_entries")
        .insert({ ...payload, legacy_id: isUuid(entry.id) ? null : entry.id });
      if (error) throw new Error(error.message);
    }
    return entry;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("payroll_entries").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Employee bank details
//
// A separate table so the staff directory can be readable without exposing
// where people are paid. Reading these needs hrm.payroll, not hrm.employees.
// ---------------------------------------------------------------------------

export type BankDetails = {
  employeeId: string;
  bankName?: string;
  branchCode?: string;
  accountNumber?: string;
  accountType?: string;
};

type BankRow = {
  employee_id: string;
  bank_name: string | null;
  branch_code: string | null;
  account_number: string | null;
  account_type: string | null;
};

/** The database uuid for an employee's app id, for tables keyed by uuid. */
export async function employeeUuid(employeeId: string): Promise<string | null> {
  return uuidFor("employees", employeeId);
}

export const BankDetailsRepo = {
  /**
   * Every employee's bank details, keyed by the app's employee id.
   *
   * Returns an empty map rather than throwing when the caller lacks payroll
   * access: the screens that use this show "missing" for an employee without
   * details, and someone who cannot see them should get exactly that.
   */
  async byEmployee(): Promise<Record<string, BankDetails>> {
    const [{ data, error }, employeeIds] = await Promise.all([
      supabase
        .from("employee_bank_details")
        .select("employee_id, bank_name, branch_code, account_number, account_type"),
      appIdMap("employees"),
    ]);
    if (error) return {};

    const out: Record<string, BankDetails> = {};
    for (const row of (data ?? []) as BankRow[]) {
      const employeeId = employeeIds.get(row.employee_id) ?? row.employee_id;
      out[employeeId] = {
        employeeId,
        bankName: row.bank_name ?? undefined,
        branchCode: row.branch_code ?? undefined,
        accountNumber: row.account_number ?? undefined,
        accountType: row.account_type ?? undefined,
      };
    }
    return out;
  },

  async upsert(details: BankDetails): Promise<void> {
    const employeeUuid = await uuidFor("employees", details.employeeId);
    if (!employeeUuid) {
      throw new Error(`Employee ${details.employeeId} was not found, so the details were not saved.`);
    }

    const { error } = await supabase.from("employee_bank_details").upsert(
      {
        employee_id: employeeUuid,
        bank_name: details.bankName ?? null,
        branch_code: details.branchCode ?? null,
        account_number: details.accountNumber ?? null,
        account_type: details.accountType ?? null,
      },
      { onConflict: "employee_id" },
    );
    if (error) throw new Error(error.message);
  },

  async remove(employeeId: string): Promise<void> {
    const employeeUuid = await uuidFor("employees", employeeId);
    if (!employeeUuid) return;
    const { error } = await supabase
      .from("employee_bank_details")
      .delete()
      .eq("employee_id", employeeUuid);
    if (error) throw new Error(error.message);
  },
};
