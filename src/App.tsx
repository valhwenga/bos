import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectTasks from "./pages/projects/Tasks";
import ProjectTimesheet from "./pages/projects/Timesheet";
import ProjectBug from "./pages/projects/Bug";
import ProjectCalendar from "./pages/projects/Calendar";
import ProjectTracker from "./pages/projects/Tracker";
import ProjectReport from "./pages/projects/Report";
import ProjectDetails from "./pages/projects/Details";
import UserRole from "./pages/UserRole";
import ManageUsers from "./pages/users/ManageUsers";
import Clients from "./pages/users/Clients";
import UserProfile from "./pages/users/Profile";
import HRMEmployees from "./pages/HRMEmployees";
import HRMDepartments from "./pages/HRMDepartments";
import HRMAttendance from "./pages/HRMAttendance";
import HRMLeave from "./pages/HRMLeave";
import HRMPayroll from "./pages/HRMPayroll";
import HRMPayrollManage from "./pages/HRMPayrollManage";
import HRMPerformance from "./pages/HRMPerformance";
import NotFound from "./pages/NotFound";
import Placeholder from "./pages/Placeholder";
import Quotations from "./pages/accounting/Quotations";
import Invoices from "./pages/accounting/Invoices";
import Customers from "./pages/accounting/Customers";
import Products from "./pages/accounting/Products";
import Taxes from "./pages/accounting/Taxes";
import Payments from "./pages/accounting/Payments";
import Expenses from "./pages/accounting/Expenses";
import Reports from "./pages/accounting/Reports";
import AccountingSettings from "./pages/accounting/Settings";
import Sales from "./pages/accounting/Sales";
import CreditNotes from "./pages/accounting/CreditNotes";
import Recurring from "./pages/accounting/Recurring";
import { UserStore } from "./lib/userStore";
import { AuthStore } from "./lib/authStore";
import AccessGuard from "@/components/auth/AccessGuard";
import { getSession } from "@/lib/session";
import SupportTickets from "./pages/support/Tickets";
import SupportTicketDetail from "./pages/support/TicketDetail";
import SupportSettings from "./pages/support/Settings";
import SupportDashboard from "./pages/support/Dashboard";
import ClientPortalSupport from "./pages/portal/support/ClientTickets";
import EmailInbox from "./pages/email/Inbox";
import EmailSent from "./pages/email/Sent";
import EmailCompose from "./pages/email/Compose";
import EmailMessage from "./pages/email/Message";
import EmailSettings from "./pages/settings/EmailSettings";
import MessengerConversations from "./pages/messenger/Conversations";
import MessengerChat from "./pages/messenger/Chat";
import InvoicePrint from "./pages/accounting/InvoicePrint";
import QuotationPrint from "./pages/accounting/QuotationPrint";
import BackupManagement from "./pages/BackupManagement";
import CrmLeads from "./pages/crm/Leads";
import CrmLeadDetail from "./pages/crm/LeadDetail";
import CrmCustomers from "./pages/crm/Customers";
import CrmDealsBoard from "./pages/crm/DealsBoard";
import CrmDealDetail from "./pages/crm/DealDetail";
import CrmTasks from "./pages/crm/Tasks";
import CrmReports from "./pages/crm/Reports";
import CrmCustomerDetail from "./pages/crm/CustomerDetail";
import { ProjectStore } from "./lib/projectStore";
import { CrmTasksStore } from "./lib/crmTasksStore";
import { notify } from "./lib/notificationsStore";
import { RecurringStore } from "./lib/recurringStore";
import { AccountingStore } from "./lib/accountingStore";
import { EmailStore } from "./lib/emailStore";
import { Invoice } from "./lib/accountingStore";
import { CompanySettingsStore } from "./lib/companySettings";
import { allocateNumber } from "./lib/documentNumbers";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import InviteAccept from "./pages/auth/InviteAccept";
import Protected from "@/components/auth/Protected";
import AuthProvider from "@/components/auth/AuthProvider";
import AwaitingApproval from "./pages/auth/AwaitingApproval";
import PendingApprovals from "./pages/auth/PendingApprovals";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import WhatsAppSettingsPage from "./pages/whatsapp/Settings";
import WaConsole from "./pages/whatsapp/Console";
import Analytics from "./pages/Analytics";
import HighPriority from "./pages/HighPriority";
import Settings from "./pages/Settings";
import Workflow from "./pages/Workflow";
import Documents from "./pages/Documents";
import Communication from "./pages/Communication";

const queryClient = new QueryClient();

type SimplePdf = {
  setFontSize: (size: number) => void;
  text: (text: string, x: number, y: number) => void;
  output: (type: "datauristring") => string;
};

const App = () => {
  useEffect(() => {
    // Simple clock-in when the app mounts (user session starts)
    UserStore.clockIn();
    const onBeforeUnload = () => {
      try { UserStore.clockOut(); } catch { void 0; }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try { UserStore.clockOut(); } catch { void 0; }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVis);
    // Session timeout enforcement per role
    let idleTimer: number | undefined;
    const resetTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      // The timeout is a property of the role, and now comes from the server
      // with the rest of the session rather than from local role data.
      const mins = getSession().sessionTimeoutMinutes ?? 0;
      if (mins > 0) {
        idleTimer = window.setTimeout(() => {
          // This used to clock the user out of attendance and stop there, so
          // the session stayed valid and an unattended machine kept payroll and
          // banking open. A session timeout has to end the session.
          try { UserStore.clockOut(); } catch { void 0; }
          // Await the sign-out before navigating, or the request to revoke the
          // token is cancelled by the reload and the session stays alive.
          void AuthStore.signOut()
            .catch(() => undefined)
            .finally(() => window.location.replace("/auth/login?reason=timeout"));
        }, mins * 60 * 1000);
      }
    };
    const activity = () => resetTimer();
    ["mousemove","keydown","scroll","click"].forEach((evt) => {
      window.addEventListener(evt, activity, { passive: true });
    });
    resetTimer();
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVis);
      ["mousemove","keydown","scroll","click"].forEach((evt) => {
        window.removeEventListener(evt, activity);
      });
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, []);

  // Recurring Invoices: auto-generate and auto-send with attachment.
  //
  // This matched templates whose nextRunAt fell within +/- 60 seconds of the
  // tick, which meant a period was billed only if somebody happened to have the
  // app open at that exact minute — and a missed window was missed permanently,
  // because nextRunAt still advanced afterwards.
  //
  // It now generates every occurrence that is due, so reopening the app catches
  // up on anything missed. The authoritative version of this is
  // generate_due_recurring_invoices() in Postgres, which runs hourly whether or
  // not anyone is signed in; this stays until the stores move over.
  useEffect(() => {
    // A template left unrun for a long time should catch up, but a
    // misconfigured one must not emit hundreds of invoices in one pass.
    const MAX_PER_TEMPLATE_PER_PASS = 12;
    const run = async () => {
      const now = Date.now();
      const list = RecurringStore.list().filter(t => t.active);
      for (const t of list) {
        if (!t.nextRunAt) continue;
        let cursor = { ...t };
        let generated = 0;
        while (
          cursor.nextRunAt &&
          new Date(cursor.nextRunAt).getTime() <= now &&
          (!cursor.endDate || new Date(cursor.nextRunAt) <= new Date(cursor.endDate)) &&
          generated < MAX_PER_TEMPLATE_PER_PASS
        ) {
          generated += 1;
          const t = cursor;
          // Generate invoice dated at run date/time
          // Recurring invoices draw from the same series as manual ones.
          // Each template used to keep its own counter starting at 1 with a
          // default 'INV-' prefix, so two templates both produced INV-0001,
          // and neither series knew about manually created invoices.
          const num = allocateNumber('invoice');
          const inv = {
            id: `inv_${Date.now()}_${generated}`,
            number: num,
            customer: t.customer,
            items: t.items,
            status: "sent" as const,
            // Dated to the period it bills, not the moment it was caught up.
            createdAt: t.nextRunAt as string,
            useShippingAddress: false,
          };
          AccountingStore.upsertInvoice(inv as Invoice);
          // Advance the cursor so the loop terminates and the next iteration
          // bills the following period.
          cursor = { ...t, lastRunAt: new Date().toISOString(), nextRunAt: RecurringStore.computeNextRun(t) };
          // Auto-send email with generic subject and PDF attachment (company template reused conceptually)
          if (t.autoSend && t.customer.email) {
            const cs = CompanySettingsStore.get();
            const subject = `Invoice ${inv.number} from ${cs.name || 'Our Company'}`;
            const body = `Dear ${t.customer.name},\n\nPlease find attached your invoice ${inv.number}.\n\nRegards,\n${cs.name || 'Our Company'}`;
            // jsPDF is a dependency, so it is bundled and works offline. This
            // used to pull 2.5.1 from a CDN while the bundle carried 4.x, and
            // swallowed a failed load before destructuring the global — so a
            // blocked CDN raised a TypeError instead of reporting anything.
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p','mm','a4');
            let y = 15;
            pdf.setFontSize(16); pdf.text(`Invoice ${inv.number}`, 15, y); y += 8;
            pdf.setFontSize(11); pdf.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 15, y); y += 6;
            pdf.text(`Bill To: ${t.customer.name}`, 15, y); y += 8;
            pdf.setFontSize(12); pdf.text('Items', 15, y); y += 6; pdf.setFontSize(11);
            let total = 0;
            t.items.forEach((it) => { const line = `${it.name}  ${it.qty} x ${it.price.toFixed(2)}`; pdf.text(line, 20, y); y += 6; total += (it.qty||0)*(it.price||0); });
            y += 4; pdf.text(`Total: ${total.toFixed(2)} ${cs.currencyCode || ''}`, 15, y);
            const dataUrl = pdf.output('datauristring');
            await EmailStore.send({
              from: { name: cs.name || 'Billing', email: cs.email || 'noreply@example.com' },
              to: [{ name: t.customer.name, email: t.customer.email }],
              subject,
              body,
              attachments: [{ id: `att_${Date.now()}`, name: `${inv.number}.pdf`, type: 'application/pdf', size: dataUrl.length, dataUrl }],
            });
          }
        }
        if (generated > 0) RecurringStore.upsert(cursor);
      }
    };
    // Hourly, plus on focus and on template changes. The old one-minute tick
    // existed only because it had to catch an exact moment; generating whatever
    // is due removes that need.
    const id = window.setInterval(run, 60 * 60 * 1000);
    window.addEventListener('acct.recurring-changed', run as EventListener);
    window.addEventListener('focus', run);
    run();
    return () => { window.clearInterval(id); window.removeEventListener('acct.recurring-changed', run as EventListener); window.removeEventListener('focus', run); };
  }, []);

  useEffect(() => {
    const read = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } };
    const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { void 0; } };
    const KEY = "proj.reminders.sent";
    // Don't request permission automatically - requires user gesture
    // Permission will be requested when user interacts with notification features

    const pushBrowserNotify = (title: string, body: string) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); return; } catch { void 0; }
      }
      try { alert(`${title}\n\n${body}`); } catch { void 0; }
    };

    const tick = () => {
      const sent = read(KEY, {} as Record<string, { w?: boolean; d?: boolean; h?: boolean }>);
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute window
      const projects = ProjectStore.listProjects();
      const tasks = ProjectStore.listTasks();
      ProjectStore.listEvents().forEach(ev => {
        if (!ev.startAt) return;
        const t = new Date(ev.startAt).getTime();
        const plan: Array<["w"|"d"|"h", boolean, number, string]> = [
          ["w", !!ev.remindWeek, t - 7 * 24 * 60 * 60 * 1000, "1 week"],
          ["d", !!ev.remindDay,  t - 24 * 60 * 60 * 1000,        "1 day"],
          ["h", !!ev.remindHour, t - 60 * 60 * 1000,             "1 hour"],
        ];
        plan.forEach(([tag, enabled, at, label]) => {
          if (!enabled) return;
          if (Math.abs(now - at) <= windowMs) {
            const rec = sent[ev.id] || {};
            if (!rec[tag]) {
              const msgTitle = `Upcoming ${ev.type || "event"}: ${ev.title}`;
              const msgBody = `Starts in ${label} at ${new Date(t).toLocaleString()}`;

              // Route to an assignee when event is tied to a project or a task
              let assigneeId: string | undefined;
              let link: string | undefined;

              if (ev.id.startsWith('ev_task_due_')) {
                const taskId = ev.id.slice('ev_task_due_'.length);
                const task = tasks.find(x => x.id === taskId);
                assigneeId = task?.assignedToUserId;
                link = '/projects/tasks';
              } else {
                const project = ev.projectId ? projects.find(p => p.id === ev.projectId) : undefined;
                assigneeId = project?.assignedToUserId;
                link = ev.projectId ? `/projects/${ev.projectId}` : undefined;
              }

              if (assigneeId) {
                notify(assigneeId, "ticket", msgTitle, msgBody, link);
              }
              pushBrowserNotify(msgTitle, msgBody);
              sent[ev.id] = { ...rec, [tag]: true };
            }
          }
        });
      });
      write(KEY, sent);
    };
    const id = window.setInterval(tick, 60 * 1000);
    window.addEventListener('proj.events-changed', tick as EventListener);
    window.addEventListener('focus', tick);
    tick();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('proj.events-changed', tick as EventListener);
      window.removeEventListener('focus', tick);
    };
  }, []);

  useEffect(() => {
    // Don't request permission automatically - requires user gesture
    // Permission will be requested when user interacts with notification features
    const onNotify = (e: Event) => {
      const n = (e as CustomEvent<unknown>).detail as { title: string; description?: string; userId?: string } | undefined;
      if (!n) return;
      try { const cur = UserStore.get(); if (n.userId && cur?.id && n.userId !== cur.id) return; } catch { void 0; }
      const title = n.title;
      const body = n.description || "";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); return; } catch { void 0; }
      }
      try { alert(`${title}${body ? `\n\n${body}` : ""}`); } catch { void 0; }
    };
    window.addEventListener("app:notify", onNotify as EventListener);
    return () => window.removeEventListener("app:notify", onNotify as EventListener);
  }, []);

  // CRM Tasks: auto due reminders (1 day / 1 hour before)
  useEffect(() => {
    const read = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } };
    const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { void 0; } };
    const KEY = "crm.tasks.reminders.sent";
    const windowMs = 60 * 1000; // 1 minute window
    const tick = () => {
      const sent = read(KEY, {} as Record<string, { d?: boolean; h?: boolean }>);
      const now = Date.now();
      CrmTasksStore.list().filter(t => !!t.assigneeId && !!t.dueAt && !t.completed).forEach(t => {
        const due = new Date(t.dueAt as string).getTime();
        const plan: Array<["d" | "h", number, string]> = [
          ["d", due - 24 * 60 * 60 * 1000, "1 day"],
          ["h", due - 60 * 60 * 1000, "1 hour"],
        ];
        plan.forEach(([tag, at, label]) => {
          if (Math.abs(now - at) <= windowMs) {
            const rec = sent[t.id] || {};
            if (!rec[tag]) {
              notify(t.assigneeId as string, 'message', `Task due ${label}: ${t.title}`, `Due at ${new Date(due).toLocaleString()}`, '/crm/tasks');
              sent[t.id] = { ...rec, [tag]: true };
            }
          }
        });
      });
      write(KEY, sent);
    };
    const id = window.setInterval(tick, 60 * 1000);
    window.addEventListener('proj.events-changed', tick as EventListener);
    window.addEventListener('focus', tick);
    tick();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('proj.events-changed', tick as EventListener);
      window.removeEventListener('focus', tick);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/invite" element={<InviteAccept />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="/auth/pending" element={<AwaitingApproval />} />

          {/* App routes (protected) with layout */}
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="users/profile" element={<UserProfile />} />
            <Route path="hrm/employees" element={<AccessGuard module="hrm.employees"><HRMEmployees /></AccessGuard>} />
            <Route path="hrm/departments" element={<AccessGuard module="hrm.departments"><HRMDepartments /></AccessGuard>} />
            <Route path="hrm/attendance" element={<AccessGuard module="hrm.attendance"><HRMAttendance /></AccessGuard>} />
            <Route path="hrm/leave" element={<AccessGuard module="hrm.leave"><HRMLeave /></AccessGuard>} />
            <Route path="hrm/payroll" element={<AccessGuard module="hrm.payroll"><HRMPayroll /></AccessGuard>} />
            <Route path="hrm/payroll/manage" element={<AccessGuard module="hrm.payroll"><HRMPayrollManage /></AccessGuard>} />
            <Route path="hrm/performance" element={<AccessGuard module="hrm.performance"><HRMPerformance /></AccessGuard>} />
            <Route path="projects" element={<AccessGuard module="projects"><Projects /></AccessGuard>} />
            <Route path="projects/:id" element={<AccessGuard module="projects"><ProjectDetails /></AccessGuard>} />
            <Route path="projects/tasks" element={<AccessGuard module="projects"><ProjectTasks /></AccessGuard>} />
            <Route path="projects/timesheet" element={<AccessGuard module="projects"><ProjectTimesheet /></AccessGuard>} />
            <Route path="projects/bug" element={<AccessGuard module="projects"><ProjectBug /></AccessGuard>} />
            <Route path="projects/calendar" element={<AccessGuard module="projects"><ProjectCalendar /></AccessGuard>} />
            <Route path="projects/tracker" element={<AccessGuard module="projects"><ProjectTracker /></AccessGuard>} />
            <Route path="projects/report" element={<AccessGuard module="projects"><ProjectReport /></AccessGuard>} />
            <Route path="users/role" element={<AccessGuard module="settings"><UserRole /></AccessGuard>} />
            {/* Accounting */}
            <Route path="accounting" element={<Navigate to="/accounting/quotations" replace />} />
            <Route path="accounting/quotations" element={<AccessGuard module="accounting"><Quotations /></AccessGuard>} />
            <Route path="accounting/quotations/:id/print" element={<AccessGuard module="accounting"><QuotationPrint /></AccessGuard>} />
            <Route path="accounting/invoices" element={<AccessGuard module="accounting"><Invoices /></AccessGuard>} />
            <Route path="accounting/invoices/:id/print" element={<AccessGuard module="accounting"><InvoicePrint /></AccessGuard>} />
            {/* CRM */}
            <Route path="crm/leads" element={<AccessGuard module="crm"><CrmLeads /></AccessGuard>} />
            <Route path="crm/leads/:id" element={<AccessGuard module="crm"><CrmLeadDetail /></AccessGuard>} />
            <Route path="crm/customers" element={<AccessGuard module="crm"><CrmCustomers /></AccessGuard>} />
            <Route path="crm/customers/:id" element={<AccessGuard module="crm"><CrmCustomerDetail /></AccessGuard>} />
            <Route path="crm/deals" element={<AccessGuard module="crm"><CrmDealsBoard /></AccessGuard>} />
            <Route path="crm/deals/:id" element={<AccessGuard module="crm"><CrmDealDetail /></AccessGuard>} />
            <Route path="crm/tasks" element={<AccessGuard module="crm"><CrmTasks /></AccessGuard>} />
            <Route path="crm/reports" element={<AccessGuard module="crm"><CrmReports /></AccessGuard>} />
            {/* More accounting */}
            <Route path="accounting/customers" element={<AccessGuard module="accounting"><Customers /></AccessGuard>} />
            <Route path="accounting/products" element={<AccessGuard module="accounting"><Products /></AccessGuard>} />
            <Route path="accounting/taxes" element={<AccessGuard module="accounting"><Taxes /></AccessGuard>} />
            <Route path="accounting/payments" element={<AccessGuard module="accounting"><Payments /></AccessGuard>} />
            <Route path="accounting/sales" element={<AccessGuard module="accounting"><Sales /></AccessGuard>} />
            <Route path="accounting/credits" element={<AccessGuard module="accounting"><CreditNotes /></AccessGuard>} />
            <Route path="accounting/recurring" element={<AccessGuard module="accounting"><Recurring /></AccessGuard>} />
            <Route path="accounting/expenses" element={<AccessGuard module="accounting"><Expenses /></AccessGuard>} />
            <Route path="accounting/reports" element={<AccessGuard module="accounting"><Reports /></AccessGuard>} />
            <Route path="accounting/settings" element={<AccessGuard module="settings"><AccountingSettings /></AccessGuard>} />
            <Route path="settings/company" element={<AccessGuard module="settings"><AccountingSettings /></AccessGuard>} />
            <Route path="settings/company/email" element={<AccessGuard module="settings"><EmailSettings /></AccessGuard>} />
            {/* Misc */}
            <Route path="users" element={<AccessGuard module="settings"><ManageUsers /></AccessGuard>} />
            <Route path="users/client" element={<AccessGuard module="settings"><Clients /></AccessGuard>} />
            <Route path="users/pending" element={<AccessGuard module="settings"><PendingApprovals /></AccessGuard>} />
            <Route path="products" element={<AccessGuard module="inventory"><Placeholder /></AccessGuard>} />
            <Route path="pos" element={<AccessGuard module="inventory"><Placeholder /></AccessGuard>} />
            <Route path="support" element={<AccessGuard module="support"><SupportDashboard /></AccessGuard>} />
            <Route path="support/tickets" element={<AccessGuard module="support"><SupportTickets /></AccessGuard>} />
            <Route path="support/tickets/:id" element={<AccessGuard module="support"><SupportTicketDetail /></AccessGuard>} />
            <Route path="support/settings" element={<AccessGuard module="support"><SupportSettings /></AccessGuard>} />
            <Route path="portal/support" element={<AccessGuard module="support"><ClientPortalSupport /></AccessGuard>} />
            <Route path="zoom" element={<AccessGuard module="dashboard"><Placeholder /></AccessGuard>} />
            <Route path="messenger" element={<AccessGuard module="messenger"><MessengerConversations /></AccessGuard>} />
            <Route path="messenger/:id" element={<AccessGuard module="messenger"><MessengerChat /></AccessGuard>} />
            <Route path="email" element={<AccessGuard module="email"><EmailInbox /></AccessGuard>} />
            <Route path="email/sent" element={<AccessGuard module="email"><EmailSent /></AccessGuard>} />
            <Route path="email/compose" element={<AccessGuard module="email"><EmailCompose /></AccessGuard>} />
            <Route path="email/:id" element={<AccessGuard module="email"><EmailMessage /></AccessGuard>} />
            {/* WhatsApp */}
            <Route path="whatsapp/settings" element={<AccessGuard module="whatsapp"><WhatsAppSettingsPage /></AccessGuard>} />
            <Route path="whatsapp" element={<AccessGuard module="whatsapp"><WaConsole /></AccessGuard>} />
            {/* Analytics & Reporting */}
            <Route path="analytics" element={<AccessGuard module="dashboard"><Analytics /></AccessGuard>} />
            {/* High Priority Center */}
            <Route path="high-priority" element={<AccessGuard module="dashboard"><HighPriority /></AccessGuard>} />
            {/* System Backup & Restore */}
            <Route path="backup" element={<AccessGuard module="settings"><BackupManagement /></AccessGuard>} />
            {/* Settings */}
            <Route path="settings" element={<AccessGuard module="settings"><Settings /></AccessGuard>} />
            {/* Workflow & Approvals */}
            <Route path="workflow" element={<AccessGuard module="dashboard"><Workflow /></AccessGuard>} />
            {/* Document Management */}
            <Route path="documents" element={<AccessGuard module="dashboard"><Documents /></AccessGuard>} />
            {/* Communication & Collaboration */}
            <Route path="communication" element={<AccessGuard module="dashboard"><Communication /></AccessGuard>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
