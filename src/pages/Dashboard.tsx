import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanySettingsStore } from "@/lib/companySettings";
import { AccountingStore } from "@/lib/accountingStore";
import { PaymentStore } from "@/lib/paymentStore";
import { UsersStore } from "@/lib/usersStore";
import { HRMDepartmentsStore } from "@/lib/hrmDepartmentsStore";
import { ProjectStore } from "@/lib/projectStore";
import { SupportStore } from "@/lib/supportStore";
import { SecurityStore } from "@/lib/securityStore";
import { CommunicationStore } from "@/lib/communicationStore";
import { CrmTasksStore } from "@/lib/crmTasksStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";
import { CrmLeadsStore } from "@/lib/crmLeadsStore";
import {
  Users, BarChart3, TrendingUp, DollarSign, Building, Calendar,
  FileText, Package, HeadphonesIcon, Clock, Bell, Plus, Database, Shield,
  MessageCircle, CheckCircle, AlertCircle
} from "lucide-react";

const Dashboard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
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
  }, []);

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
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Load data
    const user = SecurityStore.getCurrentSession();
    setCurrentUser(user);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{CompanySettingsStore.get().name || "Company Dashboard"}</h1>
          <p className="text-gray-500">Welcome back, {currentUser?.name || 'User'}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <Button variant="outline" size="sm" className="relative">
            <Bell className="w-4 h-4" />
            {liveStats.urgentTickets > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-xs">
                {liveStats.urgentTickets}
              </Badge>
            )}
          </Button>
          
          {/* Time Display */}
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-lg font-bold">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
                <div className="text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Alert Section */}
      {(liveStats.upcomingDeadlines.overdue.length > 0 || liveStats.urgentTickets > 0) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Urgent Items Require Attention</h3>
          </div>
          <div className="space-y-1 text-sm text-red-700">
            {liveStats.upcomingDeadlines.overdue.length > 0 && (
              <p>· {liveStats.upcomingDeadlines.overdue.length} overdue deadlines</p>
            )}
            {liveStats.urgentTickets > 0 && (
              <p>· {liveStats.urgentTickets} urgent support tickets</p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${liveStats.totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-green-600">+12.5% from last month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{liveStats.activeUsers}</p>
              <p className="text-xs text-gray-500">of {liveStats.totalEmployees} total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{liveStats.activeProjects}</p>
              <p className="text-xs text-gray-500">{liveStats.completedProjects} completed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <HeadphonesIcon className="w-6 h-6 text-orange-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Support Tickets</p>
              <p className="text-2xl font-bold text-gray-900">{liveStats.openTickets}</p>
              <p className="text-xs text-red-500">{liveStats.urgentTickets} urgent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-20 flex-col" onClick={() => window.location.href = '/analytics'}>
                <BarChart3 className="w-6 h-6 mb-2" />
                View Analytics
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => window.location.href = '/communication'}>
                <Users className="w-6 h-6 mb-2" />
                Messages
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => window.location.href = '/workflow'}>
                <Calendar className="w-6 h-6 mb-2" />
                Workflows
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => window.location.href = '/documents'}>
                <FileText className="w-6 h-6 mb-2" />
                Documents
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => {
                // Create backup
                import('@/lib/backupStore').then(({ BackupStore }) => {
                  try {
                    BackupStore.create();
                    alert('Backup created successfully!');
                  } catch (error) {
                    alert('Failed to create backup');
                  }
                });
              }}>
                <Database className="w-6 h-6 mb-2" />
                Create Backup
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => window.location.href = '/backup'}>
                <Shield className="w-6 h-6 mb-2" />
                Backup & Restore
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => {
                  const Icon = activity.icon;
                  const colorClass = {
                    blue: 'bg-blue-500',
                    green: 'bg-green-500',
                    orange: 'bg-orange-500',
                    red: 'bg-red-500',
                    purple: 'bg-purple-500',
                    indigo: 'bg-indigo-500'
                  }[activity.color] || 'bg-gray-500';

                  return (
                    <div key={activity.id} className="flex items-center gap-3">
                      <div className={`w-2 h-2 ${colorClass} rounded-full`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
