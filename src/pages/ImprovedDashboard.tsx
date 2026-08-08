import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BarChart3, TrendingUp, DollarSign, Building, Calendar, FileText, CreditCard, Package, HeadphonesIcon, Clock, Bell, Database, Eye, EyeOff, Plus, Lock, Mail } from "lucide-react";
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
import NavigationSidebar from "@/components/NavigationSidebar";

const ImprovedDashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Calculate live stats
  const liveStats = useMemo(() => {
    const accounting = AccountingStore.getInvoices();
    const payments = PaymentStore.getPayments();
    const users = UsersStore.getUsers();
    const departments = HRMDepartmentsStore.getDepartments();
    const projects = ProjectStore.getProjects();
    const support = SupportStore.getTickets();

    // Calculate metrics
    const totalRevenue = accounting
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    const pendingPayments = payments
      .filter(pay => pay.status === 'pending')
      .reduce((sum, pay) => sum + pay.amount, 0);

    const activeUsers = users.filter(user => user.status === 'active').length;
    const totalEmployees = users.length;

    const activeProjects = projects.filter(proj => proj.status === 'active').length;
    const completedProjects = projects.filter(proj => proj.status === 'completed').length;

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
      projects: projects.filter(proj => 
        proj.deadline && 
        new Date(proj.deadline) <= nextWeek && 
        proj.status !== 'completed'
      ),
      overdue: [
        ...accounting.filter(inv => 
          inv.dueDate && 
          new Date(inv.dueDate) < now && 
          inv.status !== 'paid'
        ),
        ...projects.filter(proj => 
          proj.deadline && 
          new Date(proj.deadline) < now && 
          proj.status !== 'completed'
        )
      ]
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Load data
    setCompanySettings(CompanySettingsStore.getSettings());
    const user = SecurityStore.getCurrentSession();
    setCurrentUser(user);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <NavigationSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">
                Welcome back, {currentUser?.name || 'User'}
              </p>
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
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
                <div className="text-xs text-gray-500">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Alert Section */}
          {(liveStats.upcomingDeadlines.overdue.length > 0 || liveStats.urgentTickets > 0) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">New invoice created</p>
                      <p className="text-xs text-gray-500">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Project completed</p>
                      <p className="text-xs text-gray-500">1 hour ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Support ticket resolved</p>
                      <p className="text-xs text-gray-500">3 hours ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ImprovedDashboard;
