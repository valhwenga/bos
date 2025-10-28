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
import UserProfile from "./pages/users/Profile";
import HRMEmployees from "./pages/HRMEmployees";
import HRMDepartments from "./pages/HRMDepartments";
import HRMAttendance from "./pages/HRMAttendance";
import HRMLeave from "./pages/HRMLeave";
import HRMPayroll from "./pages/HRMPayroll";
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
import AccessGuard from "@/components/auth/AccessGuard";
import { getCurrentRole } from "@/lib/accessControl";
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
import { CompanySettingsStore } from "./lib/companySettings";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import InviteAccept from "./pages/auth/InviteAccept";
import Protected from "@/components/auth/Protected";
import PendingApprovals from "./pages/auth/PendingApprovals";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import WhatsAppSettingsPage from "./pages/whatsapp/Settings";
import WaConsole from "./pages/whatsapp/Console";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Simple clock-in when the app mounts (user session starts)
    UserStore.clockIn();
    const onBeforeUnload = () => {
      try { UserStore.clockOut(); } catch {}
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try { UserStore.clockOut(); } catch {}
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVis);
    // Session timeout enforcement per role
    let idleTimer: number | undefined;
    const resetTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      const role = getCurrentRole();
      const mins = role.security?.sessionTimeoutMinutes ?? 0;
      if (mins > 0) {
        idleTimer = window.setTimeout(() => {
          try { UserStore.clockOut(); } catch {}
        }, mins * 60 * 1000);
      }
    };
    const activity = () => resetTimer();
    ["mousemove","keydown","scroll","click"].forEach(evt => window.addEventListener(evt, activity, { passive: true } as any));
    resetTimer();
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVis);
      ["mousemove","keydown","scroll","click"].forEach(evt => window.removeEventListener(evt, activity as any));
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, []);

  // Recurring Invoices: auto-generate and auto-send with attachment
  useEffect(() => {
    const windowMs = 60 * 1000; // 1 minute window
    const run = async () => {
      const now = Date.now();
      const list = RecurringStore.list().filter(t => t.active);
      for (const t of list) {
        if (!t.nextRunAt) continue;
        const at = new Date(t.nextRunAt).getTime();
        if (Math.abs(now - at) <= windowMs) {
          // Generate invoice dated at run date/time
          const num = `${t.seqPrefix || 'INV-'}${String(t.nextNumber || 1).padStart(4,'0')}`;
          const inv = {
            id: `inv_${Date.now()}`,
            number: num,
            customer: t.customer,
            items: t.items,
            status: "sent" as const,
            createdAt: new Date().toISOString(),
            useShippingAddress: false,
          };
          AccountingStore.upsertInvoice(inv as any);
          // Advance template schedule
          RecurringStore.upsert({ ...t, lastRunAt: new Date().toISOString(), nextRunAt: RecurringStore.computeNextRun(t), nextNumber: (t.nextNumber || 1) + 1 });
          // Auto-send email with generic subject and PDF attachment (company template reused conceptually)
          if (t.autoSend && t.customer.email) {
            const cs = CompanySettingsStore.get();
            const subject = `Invoice ${inv.number} from ${cs.name || 'Our Company'}`;
            const body = `Dear ${t.customer.name},\n\nPlease find attached your invoice ${inv.number}.\n\nRegards,\n${cs.name || 'Our Company'}`;
            // Build a simple PDF using jsPDF
            const ensureScript = (src: string) => new Promise<void>((resolve, reject) => {
              const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src)); document.head.appendChild(s);
            });
            const w: any = window as any;
            if (!(w.jspdf || w.jspdf_esm || w.jspdfjs)) {
              try { await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); } catch {}
            }
            const { jsPDF } = (w.jspdf || w.jspdf_esm || w.jspdfjs) as any;
            const pdf = new jsPDF('p','mm','a4');
            let y = 15;
            pdf.setFontSize(16); pdf.text(`Invoice ${inv.number}`, 15, y); y += 8;
            pdf.setFontSize(11); pdf.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 15, y); y += 6;
            pdf.text(`Bill To: ${t.customer.name}`, 15, y); y += 8;
            pdf.setFontSize(12); pdf.text('Items', 15, y); y += 6; pdf.setFontSize(11);
            let total = 0;
            t.items.forEach((it: any) => { const line = `${it.name}  ${it.qty} x ${it.price.toFixed(2)}`; pdf.text(line, 20, y); y += 6; total += (it.qty||0)*(it.price||0); });
            y += 4; pdf.text(`Total: ${total.toFixed(2)} ${cs.currencyCode || ''}`, 15, y);
            const dataUrl = pdf.output('datauristring');
            await EmailStore.send({
              from: { name: cs.name || 'Billing', email: cs.email || 'noreply@example.com' },
              to: [{ name: t.customer.name, email: t.customer.email }],
              subject,
              body,
              attachments: [{ id: `att_${Date.now()}`, name: `${inv.number}.pdf`, type: 'application/pdf', size: dataUrl.length, dataUrl }],
            } as any);
          }
        }
      }
    };
    const id = window.setInterval(run, 60 * 1000);
    window.addEventListener('acct.recurring-changed', run as any);
    window.addEventListener('focus', run);
    run();
    return () => { window.clearInterval(id); window.removeEventListener('acct.recurring-changed', run as any); window.removeEventListener('focus', run); };
  }, []);

  useEffect(() => {
    const read = (k: string, fb: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
    const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    const KEY = "proj.reminders.sent";
    const ensurePermission = async () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
    };
    ensurePermission();

    const notify = (title: string, body: string) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); return; } catch {}
      }
      try { alert(`${title}\n\n${body}`); } catch {}
    };

    const tick = () => {
      const sent = read(KEY, {} as Record<string, { w?: boolean; d?: boolean; h?: boolean }>);
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute window
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
              notify(`Upcoming ${ev.type || "event"}: ${ev.title}`, `Starts in ${label} at ${new Date(t).toLocaleString()}`);
              sent[ev.id] = { ...rec, [tag]: true };
            }
          }
        });
      });
      write(KEY, sent);
    };
    const id = window.setInterval(tick, 60 * 1000);
    window.addEventListener('proj.events-changed', tick as any);
    window.addEventListener('focus', tick);
    tick();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('proj.events-changed', tick as any);
      window.removeEventListener('focus', tick);
    };
  }, []);

  useEffect(() => {
    const ensurePermission = async () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
    };
    ensurePermission();
    const onNotify = (e: Event) => {
      const anyE = e as CustomEvent<any>;
      const n = anyE.detail as { title: string; description?: string; userId?: string } | undefined;
      if (!n) return;
      try { const cur = UserStore.get(); if (n.userId && cur?.id && n.userId !== cur.id) return; } catch {}
      const title = n.title;
      const body = n.description || "";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); return; } catch {}
      }
      try { alert(`${title}${body ? `\n\n${body}` : ""}`); } catch {}
    };
    window.addEventListener("app:notify", onNotify as EventListener);
    return () => window.removeEventListener("app:notify", onNotify as EventListener);
  }, []);

  // CRM Tasks: auto due reminders (1 day / 1 hour before)
  useEffect(() => {
    const read = (k: string, fb: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
    const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    const KEY = "crm.tasks.reminders.sent";
    const windowMs = 60 * 1000; // 1 minute window
    const tick = () => {
      const sent = read(KEY, {} as Record<string, { d?: boolean; h?: boolean }>);
      const now = Date.now();
      CrmTasksStore.list().filter(t => !!t.assigneeId && !!t.dueAt && !t.completed).forEach(t => {
        const due = new Date(t.dueAt as string).getTime();
        const plan: Array<["d"|"h", number, string]> = [
          ["d", due - 24*60*60*1000, "1 day"],
          ["h", due - 60*60*1000,    "1 hour"],
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
    window.addEventListener('crm.tasks-changed', tick as any);
    window.addEventListener('focus', tick);
    tick();
    return () => {
      window.clearInterval(id);
      window.removeEventListener('crm.tasks-changed', tick as any);
      window.removeEventListener('focus', tick);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/invite" element={<InviteAccept />} />
          <Route path="/auth/pending-approvals" element={<Protected><PendingApprovals /></Protected>} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />

          {/* App routes (protected) with layout */}
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="users/profile" element={<UserProfile />} />
            <Route path="hrm/employees" element={<AccessGuard module="hrm.employees"><HRMEmployees /></AccessGuard>} />
            <Route path="hrm/departments" element={<AccessGuard module="hrm.departments"><HRMDepartments /></AccessGuard>} />
            <Route path="hrm/attendance" element={<AccessGuard module="hrm.attendance"><HRMAttendance /></AccessGuard>} />
            <Route path="hrm/leave" element={<AccessGuard module="hrm.attendance"><HRMLeave /></AccessGuard>} />
            <Route path="hrm/payroll" element={<AccessGuard module="hrm.payroll"><HRMPayroll /></AccessGuard>} />
            <Route path="hrm/performance" element={<AccessGuard module="hrm.performance"><HRMPerformance /></AccessGuard>} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="projects/tasks" element={<ProjectTasks />} />
            <Route path="projects/timesheet" element={<ProjectTimesheet />} />
            <Route path="projects/bug" element={<ProjectBug />} />
            <Route path="projects/calendar" element={<ProjectCalendar />} />
            <Route path="projects/tracker" element={<ProjectTracker />} />
            <Route path="projects/report" element={<ProjectReport />} />
            <Route path="users/role" element={<UserRole />} />
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
            <Route path="settings/company" element={<AccountingSettings />} />
            <Route path="settings/company/email" element={<AccessGuard module="settings"><EmailSettings /></AccessGuard>} />
            {/* Misc */}
            <Route path="users" element={<ManageUsers />} />
            <Route path="products" element={<Placeholder />} />
            <Route path="pos" element={<Placeholder />} />
            <Route path="support" element={<AccessGuard module="support"><SupportDashboard /></AccessGuard>} />
            <Route path="support/tickets" element={<AccessGuard module="support"><SupportTickets /></AccessGuard>} />
            <Route path="support/tickets/:id" element={<AccessGuard module="support"><SupportTicketDetail /></AccessGuard>} />
            <Route path="support/settings" element={<AccessGuard module="support"><SupportSettings /></AccessGuard>} />
            <Route path="portal/support" element={<ClientPortalSupport />} />
            <Route path="zoom" element={<Placeholder />} />
            <Route path="messenger" element={<AccessGuard module="messenger"><MessengerConversations /></AccessGuard>} />
            <Route path="messenger/:id" element={<AccessGuard module="messenger"><MessengerChat /></AccessGuard>} />
            <Route path="email" element={<AccessGuard module="email"><EmailInbox /></AccessGuard>} />
            <Route path="email/sent" element={<AccessGuard module="email"><EmailSent /></AccessGuard>} />
            <Route path="email/compose" element={<AccessGuard module="email"><EmailCompose /></AccessGuard>} />
            <Route path="email/:id" element={<AccessGuard module="email"><EmailMessage /></AccessGuard>} />
            {/* WhatsApp */}
            <Route path="whatsapp/settings" element={<AccessGuard module="whatsapp"><WhatsAppSettingsPage /></AccessGuard>} />
            <Route path="whatsapp" element={<AccessGuard module="whatsapp"><WaConsole /></AccessGuard>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
