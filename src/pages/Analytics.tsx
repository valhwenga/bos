import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { AnalyticsStore } from '@/lib/analyticsStore';
import { BarChart3, TrendingUp, FileText, Download, Settings } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
  const handleExportReport = (format: 'pdf' | 'excel' | 'csv') => {
    const analyticsData = AnalyticsStore.getAnalyticsData();
    
    if (format === 'csv') {
      // Create CSV content
      const csvContent = [
        'Metric,Value',
        `Total Revenue,${analyticsData.revenue.totalRevenue}`,
        `Monthly Revenue,${analyticsData.revenue.monthlyRevenue}`,
        `Total Customers,${analyticsData.customers.totalCustomers}`,
        `Active Employees,${analyticsData.employees.activeEmployees}`,
        `Financial Health Score,${analyticsData.financial.financialHealthScore}`,
        `Total Projects,${analyticsData.projects.totalProjects}`,
        `Support Tickets,${analyticsData.support.totalTickets}`,
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // For PDF and Excel, show placeholder
      alert(`${format.toUpperCase()} export will be implemented with a proper library`);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics & Reporting</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>»</span>
            <span className="text-primary">Analytics</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => handleExportReport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('excel')}>
            <FileText className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue Analytics</p>
                <p className="font-semibold">Trends & Forecasts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Customer Insights</p>
                <p className="font-semibold">Growth & Retention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Financial Health</p>
                <p className="font-semibold">KPIs & Metrics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Custom Reports</p>
                <p className="font-semibold">Build & Schedule</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Dashboard */}
      <AnalyticsDashboard />
    </div>
  );
};

export default AnalyticsPage;
