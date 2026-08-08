import { AccountingStore } from './accountingStore';
import { PaymentStore } from './paymentStore';
import { UsersStore } from './usersStore';
import { CustomersStore } from './customersStore';
import { SupportStore } from './supportStore';
import { ProjectStore } from './projectStore';
import { CompanySettingsStore } from './companySettings';

export interface RevenueMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  quarterlyRevenue: number;
  yearlyRevenue: number;
  revenueGrowth: number;
  averageInvoiceValue: number;
  revenueByMonth: { month: string; revenue: number }[];
  revenueByCategory: { category: string; revenue: number; percentage: number }[];
  forecastedRevenue: { period: string; forecast: number; confidence: number }[];
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomersThisMonth: number;
  customerRetentionRate: number;
  customerAcquisitionCost: number;
  averageCustomerValue: number;
  customersByStatus: { status: string; count: number }[];
  customerGrowthTrend: { month: string; customers: number }[];
  topCustomersByRevenue: { name: string; revenue: number; percentage: number }[];
}

export interface EmployeeMetrics {
  totalEmployees: number;
  activeEmployees: number;
  employeeProductivity: number;
  averageSalary: number;
  payrollGrowth: number;
  employeesByDepartment: { department: string; count: number }[];
  employeePerformance: { name: string; performance: number; department: string }[];
  turnoverRate: number;
}

export interface FinancialHealth {
  profitMargin: number;
  operatingExpenses: number;
  cashFlow: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  returnOnAssets: number;
  financialHealthScore: number;
}

export interface SupportMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  customerSatisfaction: number;
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  resolutionTrend: { month: string; resolved: number; averageTime: number }[];
}

export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProjectDuration: number;
  projectSuccessRate: number;
  projectsByStatus: { status: string; count: number }[];
  projectBudgetUtilization: { project: string; budget: number; spent: number; utilization: number }[];
  revenueByProject: { project: string; revenue: number }[];
}

export interface AnalyticsData {
  revenue: RevenueMetrics;
  customers: CustomerMetrics;
  employees: EmployeeMetrics;
  financial: FinancialHealth;
  support: SupportMetrics;
  projects: ProjectMetrics;
  lastUpdated: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'revenue' | 'customer' | 'employee' | 'financial' | 'support' | 'project' | 'custom';
  metrics: string[];
  filters: Record<string, any>;
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'manual';
  recipients: string[];
  isActive: boolean;
  createdAt: string;
  lastRun?: string;
}

const ANALYTICS_KEY = 'analytics_data';
const REPORTS_KEY = 'report_templates';

export const AnalyticsStore = {
  // Calculate revenue metrics
  calculateRevenueMetrics(): RevenueMetrics {
    const invoices = AccountingStore.listInvoices();
    const payments = PaymentStore.list();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate total from invoice items
    const calculateInvoiceTotal = (invoice: any) => {
      return invoice.items.reduce((sum: number, item: any) => sum + (item.qty * item.price), 0) + (invoice.shipping || 0);
    };
    
    // Total revenue from paid invoices
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    // Monthly revenue
    const monthlyRevenue = invoices
      .filter(inv => {
        if (inv.status !== 'paid') return false;
        const invDate = new Date(inv.dueDate || inv.createdAt);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    // Quarterly revenue
    const currentQuarter = Math.floor(currentMonth / 3);
    const quarterlyRevenue = invoices
      .filter(inv => {
        if (inv.status !== 'paid') return false;
        const invDate = new Date(inv.dueDate || inv.createdAt);
        const invQuarter = Math.floor(invDate.getMonth() / 3);
        return invQuarter === currentQuarter && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    // Yearly revenue
    const yearlyRevenue = invoices
      .filter(inv => {
        if (inv.status !== 'paid') return false;
        const invDate = new Date(inv.dueDate || inv.createdAt);
        return invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    // Revenue by month (last 12 months)
    const revenueByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthRevenue = invoices
        .filter(inv => {
          if (inv.status !== 'paid') return false;
          const invDate = new Date(inv.dueDate || inv.createdAt);
          return invDate.getMonth() === date.getMonth() && invDate.getFullYear() === date.getFullYear();
        })
        .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
      revenueByMonth.push({ month: monthName, revenue: monthRevenue });
    }

    // Revenue by category (simulated)
    const revenueByCategory = [
      { category: 'Services', revenue: totalRevenue * 0.6, percentage: 60 },
      { category: 'Products', revenue: totalRevenue * 0.3, percentage: 30 },
      { category: 'Consulting', revenue: totalRevenue * 0.1, percentage: 10 },
    ];

    // Average invoice value
    const averageInvoiceValue = invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0) / invoices.length 
      : 0;

    // Revenue growth (month over month)
    const lastMonthRevenue = revenueByMonth[revenueByMonth.length - 2]?.revenue || 0;
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Simple forecast (linear trend)
    const forecastedRevenue = [];
    for (let i = 1; i <= 6; i++) {
      const date = new Date(currentYear, currentMonth + i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const trend = revenueGrowth / 100;
      const forecast = monthlyRevenue * (1 + trend * i);
      const confidence = Math.max(0.5, 0.9 - (i * 0.1)); // Decreasing confidence
      forecastedRevenue.push({ period: monthName, forecast, confidence });
    }

    return {
      totalRevenue,
      monthlyRevenue,
      quarterlyRevenue,
      yearlyRevenue,
      revenueGrowth,
      averageInvoiceValue,
      revenueByMonth,
      revenueByCategory,
      forecastedRevenue,
    };
  },

  // Calculate customer metrics
  calculateCustomerMetrics(): CustomerMetrics {
    const customers = CustomersStore.list();
    const invoices = AccountingStore.listInvoices();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalCustomers = customers.length;

    // New customers this month (simplified - using invoice creation dates)
    const newCustomersThisMonth = customers.filter(customer => {
      const customerInvoices = invoices.filter(inv => inv.customer?.id === customer.id);
      if (customerInvoices.length === 0) return false;
      const firstInvoice = customerInvoices[0];
      const createdDate = new Date(firstInvoice.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length;

    // Customer retention rate (simplified)
    const activeCustomers = customers.filter(c => {
      const customerInvoices = invoices.filter(inv => inv.customer?.id === c.id);
      return customerInvoices.length > 0;
    }).length;
    const customerRetentionRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

    // Customer acquisition cost (simplified)
    const marketingSpend = 10000; // Placeholder
    const customerAcquisitionCost = newCustomersThisMonth > 0 ? marketingSpend / newCustomersThisMonth : 0;

    // Average customer value
    const calculateInvoiceTotal = (invoice: any) => {
      return invoice.items.reduce((sum: number, item: any) => sum + (item.qty * item.price), 0) + (invoice.shipping || 0);
    };
    
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
    const averageCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Customers by status (simulated)
    const customersByStatus = [
      { status: 'Active', count: activeCustomers },
      { status: 'Inactive', count: totalCustomers - activeCustomers },
      { status: 'Prospect', count: 0 },
    ];

    // Customer growth trend
    const customerGrowthTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      // Simulated growth data
      const baseCustomers = 50;
      const growth = Math.max(0, baseCustomers + (i * 2) + Math.floor(Math.random() * 10));
      customerGrowthTrend.push({ month: monthName, customers: growth });
    }

    // Top customers by revenue
    const customerRevenue = new Map<string, number>();
    invoices.forEach(inv => {
      if (inv.status === 'paid' && inv.customer) {
        const current = customerRevenue.get(inv.customer.id) || 0;
        customerRevenue.set(inv.customer.id, current + calculateInvoiceTotal(inv));
      }
    });

    const topCustomersByRevenue = Array.from(customerRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([customerId, revenue], index) => {
        const customer = customers.find(c => c.id === customerId);
        return {
          name: customer?.name || `Customer ${index + 1}`,
          revenue,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      });

    return {
      totalCustomers,
      newCustomersThisMonth,
      customerRetentionRate,
      customerAcquisitionCost,
      averageCustomerValue,
      customersByStatus,
      customerGrowthTrend,
      topCustomersByRevenue,
    };
  },

  // Calculate employee metrics
  calculateEmployeeMetrics(): EmployeeMetrics {
    const employees = UsersStore.list();
    const payrollData = this.getPayrollData();

    const totalEmployees = employees.length;
    const activeEmployees = employees.length; // Simplified - assume all are active

    // Average salary
    const totalSalary = payrollData.reduce((sum, emp) => sum + (emp.netSalary || 0), 0);
    const averageSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;

    // Employee productivity (revenue per employee)
    const revenueMetrics = this.calculateRevenueMetrics();
    const employeeProductivity = activeEmployees > 0 ? revenueMetrics.monthlyRevenue / activeEmployees : 0;

    // Payroll growth (simplified)
    const payrollGrowth = 5.2; // Placeholder

    // Employees by department (simulated)
    const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
    const employeesByDepartment = departments.map(dept => ({
      department: dept,
      count: Math.floor(Math.random() * 10) + 1, // Simulated data
    }));

    // Employee performance (simulated)
    const employeePerformance = employees.slice(0, 5).map(emp => ({
      name: emp.name,
      performance: Math.random() * 100,
      department: 'Unknown', // Simplified
    }));

    // Turnover rate (simplified)
    const turnoverRate = 8.5; // Placeholder

    return {
      totalEmployees,
      activeEmployees,
      employeeProductivity,
      averageSalary,
      payrollGrowth,
      employeesByDepartment,
      employeePerformance,
      turnoverRate,
    };
  },

  // Calculate financial health
  calculateFinancialHealth(): FinancialHealth {
    const revenueMetrics = this.calculateRevenueMetrics();
    const employeeMetrics = this.calculateEmployeeMetrics();

    // Simplified financial calculations
    const totalExpenses = employeeMetrics.averageSalary * employeeMetrics.activeEmployees * 12; // Annual
    const profitMargin = revenueMetrics.yearlyRevenue > 0 
      ? ((revenueMetrics.yearlyRevenue - totalExpenses) / revenueMetrics.yearlyRevenue) * 100 
      : 0;

    const operatingExpenses = totalExpenses;
    const cashFlow = revenueMetrics.monthlyRevenue - (operatingExpenses / 12);

    // Simplified ratios
    const currentAssets = revenueMetrics.monthlyRevenue * 2; // Placeholder
    const currentLiabilities = operatingExpenses / 12; // Placeholder
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

    const quickAssets = currentAssets * 0.8; // Placeholder
    const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;

    const debtToEquity = 0.3; // Placeholder
    const returnOnAssets = revenueMetrics.yearlyRevenue > 0 ? (profitMargin / 100) * 1.5 : 0;

    // Financial health score (0-100)
    const healthScore = Math.max(0, Math.min(100, 
      (profitMargin > 0 ? 25 : 0) +
      (currentRatio > 1.5 ? 25 : currentRatio * 16.67) +
      (cashFlow > 0 ? 25 : 0) +
      (returnOnAssets > 0.1 ? 25 : returnOnAssets * 250)
    ));

    return {
      profitMargin,
      operatingExpenses,
      cashFlow,
      debtToEquity,
      currentRatio,
      quickRatio,
      returnOnAssets,
      financialHealthScore: healthScore,
    };
  },

  // Calculate support metrics
  calculateSupportMetrics(): SupportMetrics {
    const tickets = SupportStore.list();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => t.status === 'open').length;
    const resolvedTickets = tickets.filter(t => t.status === 'closed').length;

    // Average resolution time (simplified)
    const resolutionTimes = tickets
      .filter(t => t.status === 'closed')
      .map(t => {
        const created = new Date(t.createdAt);
        const updated = new Date(); // Using current time as fallback
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      });
    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    // Customer satisfaction (simulated)
    const customerSatisfaction = 85.5; // Placeholder

    // Tickets by priority
    const ticketsByPriority = [
      { priority: 'High', count: tickets.filter(t => t.priority === 'high').length },
      { priority: 'Medium', count: tickets.filter(t => t.priority === 'medium').length },
      { priority: 'Low', count: tickets.filter(t => t.priority === 'low').length },
    ];

    // Tickets by category
    const ticketsByCategory = [
      { category: 'Technical', count: Math.floor(tickets.length * 0.4) },
      { category: 'Billing', count: Math.floor(tickets.length * 0.3) },
      { category: 'General', count: Math.floor(tickets.length * 0.3) },
    ];

    // Resolution trend
    const resolutionTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const resolved = Math.floor(Math.random() * 50) + 20;
      const avgTime = Math.random() * 24 + 2;
      resolutionTrend.push({ month: monthName, resolved, averageTime: avgTime });
    }

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      averageResolutionTime,
      customerSatisfaction,
      ticketsByPriority,
      ticketsByCategory,
      resolutionTrend,
    };
  },

  // Calculate project metrics
  calculateProjectMetrics(): ProjectMetrics {
    const projects = ProjectStore.listProjects();

    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'open').length;
    const completedProjects = projects.filter(p => p.status === 'closed').length;

    // Average project duration (simplified)
    const durations = projects
      .filter(p => p.status === 'closed')
      .map(p => {
        const created = new Date(p.createdAt);
        const updated = new Date(); // Using current time as fallback
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
      });
    const averageProjectDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;

    // Project success rate
    const projectSuccessRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

    // Projects by status
    const projectsByStatus = [
      { status: 'Open', count: activeProjects },
      { status: 'Closed', count: completedProjects },
      { status: 'Pending', count: projects.filter(p => p.status === 'pending_approval').length },
    ];

    // Project budget utilization (simulated)
    const projectBudgetUtilization = projects.slice(0, 5).map(project => ({
      project: project.name,
      budget: 100000, // Placeholder
      spent: Math.random() * 100000,
      utilization: Math.random() * 100,
    }));

    // Revenue by project (simulated)
    const revenueByProject = projects.slice(0, 5).map(project => ({
      project: project.name,
      revenue: Math.random() * 50000 + 10000,
    }));

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      averageProjectDuration,
      projectSuccessRate,
      projectsByStatus,
      projectBudgetUtilization,
      revenueByProject,
    };
  },

  // Get complete analytics data
  getAnalyticsData(): AnalyticsData {
    const cachedData = localStorage.getItem(ANALYTICS_KEY);
    if (cachedData) {
      const data = JSON.parse(cachedData);
      const lastUpdated = new Date(data.lastUpdated);
      const now = new Date();
      
      // Use cached data if less than 5 minutes old
      if (now.getTime() - lastUpdated.getTime() < 5 * 60 * 1000) {
        return data;
      }
    }

    // Calculate fresh analytics
    const analyticsData: AnalyticsData = {
      revenue: this.calculateRevenueMetrics(),
      customers: this.calculateCustomerMetrics(),
      employees: this.calculateEmployeeMetrics(),
      financial: this.calculateFinancialHealth(),
      support: this.calculateSupportMetrics(),
      projects: this.calculateProjectMetrics(),
      lastUpdated: new Date().toISOString(),
    };

    // Cache the data
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analyticsData));

    return analyticsData;
  },

  // Report templates management
  getReportTemplates(): ReportTemplate[] {
    try {
      const templates = localStorage.getItem(REPORTS_KEY);
      return templates ? JSON.parse(templates) : [];
    } catch {
      return [];
    }
  },

  createReportTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt'>): ReportTemplate {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `report_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const templates = this.getReportTemplates();
    templates.push(newTemplate);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(templates));

    return newTemplate;
  },

  updateReportTemplate(id: string, updates: Partial<ReportTemplate>): ReportTemplate | null {
    const templates = this.getReportTemplates();
    const index = templates.findIndex(t => t.id === id);
    
    if (index === -1) return null;

    templates[index] = { ...templates[index], ...updates };
    localStorage.setItem(REPORTS_KEY, JSON.stringify(templates));

    return templates[index];
  },

  deleteReportTemplate(id: string): boolean {
    const templates = this.getReportTemplates();
    const filtered = templates.filter(t => t.id !== id);
    
    if (filtered.length === templates.length) return false;

    localStorage.setItem(REPORTS_KEY, JSON.stringify(filtered));
    return true;
  },

  // Helper method to get payroll data
  getPayrollData() {
    // This would typically come from your payroll system
    return [
      { netSalary: 85000 },
      { netSalary: 75000 },
      { netSalary: 70000 },
      { netSalary: 72000 },
      { netSalary: 65000 },
      { netSalary: 68000 },
    ];
  },
};
