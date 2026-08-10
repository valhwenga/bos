import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanySettingsStore } from "@/lib/companySettings";
import { AccountingStore } from "@/lib/accountingStore";
import { PaymentStore } from "@/lib/paymentStore";
import { UsersStore } from "@/lib/usersStore";
import { HRMDepartmentsStore } from "@/lib/hrmDepartmentsStore";
import { ProjectStore } from "@/lib/projectStore";
import { SupportStore } from "@/lib/supportStore";
import { AuthStore } from "@/lib/authStore";
import { CommunicationStore } from "@/lib/communicationStore";
import { CrmTasksStore } from "@/lib/crmTasksStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";
import { CrmLeadsStore } from "@/lib/crmLeadsStore";
import {
  Users, BarChart3, TrendingUp, DollarSign, Building, Calendar,
  FileText, Package, HeadphonesIcon, Clock, Bell, Plus, Database, Shield,
  MessageCircle, CheckCircle, AlertCircle
} from "lucide-react";

/**
 * Ticks whenever stored data may have changed, so the summaries below
 * recompute. They previously used an empty dependency array and therefore
 * showed whatever was true when the page first mounted.
 */
const DATA_CHANGE_EVENTS = [
  "storage",
  "auth-changed",
  "acct.recurring-changed",
  "proj.events-changed",
  "company-settings-changed",
];

function useDataVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    DATA_CHANGE_EVENTS.forEach((e) => window.addEventListener(e, bump));
    window.addEventListener("focus", bump);
    return () => {
      DATA_CHANGE_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener("focus", bump);
    };
  }, []);
  return version;
}

/** Isolated so the 1Hz clock doesn't re-render the whole dashboard. */
const HeaderClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <div className="text-lg font-bold">{now.toLocaleTimeString('en-US', { hour12: false })}</div>
      <div className="text-xs text-muted-foreground">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    </>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const dataVersion = useDataVersion();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Calculate live stats
  const liveStats = useMemo(() => {
    const accounting = AccountingStore.listInvoices();
    const payments = PaymentStore.list();
    const users = UsersStore.list();
    const departments = HRMDepartmentsStore.list();
    const projects = ProjectStore.listProjects();
    const support = SupportStore.list();

    // Calculate metrics
    const totalRevenue = accounting
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => {
        const total = inv.items.reduce((itemSum, item) => itemSum + (item.qty * item.price), 0);
        return sum + total;
      }, 0);

    const pendingPayments = payments
      .reduce((sum, pay) => sum + pay.amount, 0);

    const activeUsers = users.filter(user => user.status === 'active').length;
    const totalEmployees = users.length;

    const activeProjects = projects.filter(proj => proj.status === 'open' || proj.status === 'in_progress').length;
    const completedProjects = projects.filter(proj => proj.status === 'closed').length;

    const openTickets = support.filter(ticket => ticket.status === 'open').length;
    const urgentTickets = support.filter(ticket => ticket.priority === 'urgent').length;

    // Upcoming deadlines (next 7 days)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDeadlines = {
      invoices: accounting.filter(inv =>
        inv.dueDate &&
        new Date(inv.dueDate) <= nextWeek &&
        inv.status !== 'paid'
      ),
      projects: [], // Projects don't have deadline field in current type
      overdue: accounting.filter(inv =>
        inv.dueDate &&
        new Date(inv.dueDate) < now &&
        inv.status !== 'paid'
      )
    };

    return {
      totalRevenue,
      pendingPayments,
      activeUsers,
      totalEmployees,
      activeProjects,
      completedProjects,
      openTickets,
      urgentTickets,
      upcomingDeadlines
    };
  }, [dataVersion]);

  // Get recent activities from all system stores
  const recentActivities = useMemo(() => {
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      time: string;
      timestamp: number;
      icon: any;
      color: string;
    }> = [];

    const now = Date.now();
    const formatTime = (timestamp: string | number) => {
      const date = new Date(timestamp);
      const diff = now - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      return `${days} day${days > 1 ? 's' : ''} ago`;
    };

    // Invoices
    AccountingStore.listInvoices().forEach(inv => {
      if (inv.createdAt) {
        activities.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          title: `Invoice ${inv.number || inv.id} ${inv.status === 'paid' ? 'paid' : 'created'}`,
          time: formatTime(inv.createdAt),
          timestamp: new Date(inv.createdAt).getTime(),
          icon: FileText,
          color: inv.status === 'paid' ? 'green' : 'blue'
        });
      }
    });

    // Messages
    CommunicationStore.getMessages().forEach(msg => {
      if (msg.createdAt) {
        activities.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: `New message from ${msg.senderName || msg.senderId || 'Unknown'}`,
          time: formatTime(msg.createdAt),
          timestamp: new Date(msg.createdAt).getTime(),
          icon: MessageCircle,
          color: 'purple'
        });
      }
    });

    // CRM Tasks
    CrmTasksStore.list().forEach(task => {
      if (task.createdAt) {
        activities.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.completed ? `Task completed: ${task.title}` : `Task created: ${task.title}`,
          time: formatTime(task.createdAt),
          timestamp: new Date(task.createdAt).getTime(),
          icon: CheckCircle,
          color: task.completed ? 'green' : 'orange'
        });
      }
    });

    // CRM Deals
    CrmDealsStore.list().forEach(deal => {
      if (deal.createdAt) {
        activities.push({
          id: `deal-${deal.id}`,
          type: 'deal',
          title: `Deal "${deal.title}" in ${deal.stage}`,
          time: formatTime(deal.createdAt),
          timestamp: new Date(deal.createdAt).getTime(),
          icon: DollarSign,
          color: 'blue'
        });
      }
    });

    // CRM Leads
    CrmLeadsStore.list().forEach(lead => {
      if (lead.createdAt) {
        activities.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          title: `Lead "${lead.name}" - ${lead.stage}`,
          time: formatTime(lead.createdAt),
          timestamp: new Date(lead.createdAt).getTime(),
          icon: Users,
          color: 'indigo'
        });
      }
    });

    // Support Tickets
    SupportStore.list().forEach(ticket => {
      if (ticket.createdAt) {
        activities.push({
          id: `ticket-${ticket.id}`,
          type: 'ticket',
          title: ticket.status === 'open' ? `Ticket opened: ${ticket.title}` : `Ticket resolved: ${ticket.title}`,
          time: formatTime(ticket.createdAt),
          timestamp: new Date(ticket.createdAt).getTime(),
          icon: HeadphonesIcon,
          color: ticket.priority === 'urgent' ? 'red' : 'orange'
        });
      }
    });

    // Projects
    ProjectStore.listProjects().forEach(proj => {
      if (proj.createdAt) {
        activities.push({
          id: `proj-${proj.id}`,
          type: 'project',
          title: `Project "${proj.name}" ${proj.status === 'closed' ? 'completed' : 'updated'}`,
          time: formatTime(proj.createdAt),
          timestamp: new Date(proj.createdAt).getTime(),
          icon: Building,
          color: proj.status === 'closed' ? 'green' : 'blue'
        });
      }
    });

    // Sort by timestamp (most recent first) and take top 10
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [dataVersion]);

  // Identity comes from the signed-in account. SecurityStore is a separate,
  // parallel user system and returns null for accounts created via AuthStore,
  // which is why this greeted everyone anonymously.
  useEffect(() => {
    setCurrentUser(AuthStore.currentUser());
  }, [dataVersion]);

  const company = CompanySettingsStore.get();
  const currency = company.currencySymbol || "$";
  const overdueCount = liveStats.upcomingDeadlines.overdue.length;
  const dueSoonCount = liveStats.upcomingDeadlines.invoices.length;

  const quickActions = [
    { label: "Analytics", icon: BarChart3, to: "/analytics" },
    { label: "Communication", icon: MessageCircle, to: "/communication" },
    { label: "Workflows", icon: Calendar, to: "/workflow" },
    { label: "Documents", icon: FileText, to: "/documents" },
    { label: "Invoices", icon: DollarSign, to: "/accounting/invoices" },
    { label: "Backup", icon: Database, to: "/backup" },
  ];

  const ACTIVITY_TONE: Record<string, string> = {
    green: "bg-success",
    blue: "bg-info",
    indigo: "bg-info",
    orange: "bg-warning",
    red: "bg-danger",
    purple: "bg-primary",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Good to see you, ${(currentUser?.name || "there").split(" ")[0]}`}
        description={`Here's where ${company.name || "the business"} stands today.`}
      />

      {/* Only surfaces when something genuinely needs attention. */}
      {(overdueCount > 0 || liveStats.urgentTickets > 0) && (
        <div className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger-soft p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {overdueCount > 0 && (
              <Link to="/accounting/invoices" className="hover:text-foreground hover:underline">
                {overdueCount} overdue invoice{overdueCount === 1 ? "" : "s"}
              </Link>
            )}
            {liveStats.urgentTickets > 0 && (
              <Link to="/support/tickets" className="hover:text-foreground hover:underline">
                {liveStats.urgentTickets} urgent ticket{liveStats.urgentTickets === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={`${currency}${liveStats.totalRevenue.toLocaleString()}`}
          hint="From paid invoices"
          icon={DollarSign}
          tone="success"
          onClick={() => navigate("/accounting/invoices")}
        />
        <StatCard
          label="Active people"
          value={liveStats.activeUsers}
          hint={`of ${liveStats.totalEmployees} on the team`}
          icon={Users}
          onClick={() => navigate("/hrm/employees")}
        />
        <StatCard
          label="Open projects"
          value={liveStats.activeProjects}
          hint={`${liveStats.completedProjects} completed`}
          icon={Package}
          tone="info"
          onClick={() => navigate("/projects")}
        />
        <StatCard
          label="Open tickets"
          value={liveStats.openTickets}
          hint={liveStats.urgentTickets ? `${liveStats.urgentTickets} urgent` : "None urgent"}
          icon={HeadphonesIcon}
          tone={liveStats.urgentTickets ? "danger" : "neutral"}
          onClick={() => navigate("/support/tickets")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">Jump to</h2>
            <p className="text-xs text-muted-foreground">Press ⌘K to search everything.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickActions.map(({ label, icon: Icon, to }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-4 text-center text-sm text-foreground transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
            {dueSoonCount > 0 && (
              <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">
                {dueSoonCount} due this week
              </span>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Invoices, deals, tasks and tickets will appear here as your team works."
            />
          ) : (
            <ul className="flex flex-col">
              {recentActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 border-b border-border py-2.5 last:border-0"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_TONE[activity.color] ?? "bg-muted-foreground"}`}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm text-foreground">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
