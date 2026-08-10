import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsStore, AnalyticsData } from '@/lib/analyticsStore';
import { CompanySettingsStore } from '@/lib/companySettings';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Briefcase,
  HeadphonesIcon,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  RefreshCw,
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const AnalyticsDashboard: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const companySettings = CompanySettingsStore.get();

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = () => {
    setLoading(true);
    try {
      const data = AnalyticsStore.getAnalyticsData();
      setAnalyticsData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${companySettings.currencySymbol || 'R'}${amount.toLocaleString()}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success bg-success-soft';
    if (score >= 60) return 'text-warning bg-warning-soft';
    return 'text-danger bg-danger-soft';
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? (
      <TrendingUp className="w-4 h-4 text-success" />
    ) : (
      <TrendingDown className="w-4 h-4 text-danger" />
    );
  };

  if (loading || !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Last updated: {lastRefresh.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(analyticsData.revenue.totalRevenue)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(analyticsData.revenue.revenueGrowth)}
                  <span className="text-sm">{formatPercentage(analyticsData.revenue.revenueGrowth)}</span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{analyticsData.customers.totalCustomers}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Users className="w-4 h-4 text-success" />
                  <span className="text-sm">{analyticsData.customers.newCustomersThisMonth} new this month</span>
                </div>
              </div>
              <Users className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-bold">{analyticsData.employees.activeEmployees}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span className="text-sm">{formatCurrency(analyticsData.employees.averageSalary)} avg salary</span>
                </div>
              </div>
              <Briefcase className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Financial Health</p>
                <p className="text-2xl font-bold">{formatPercentage(analyticsData.financial.financialHealthScore)}</p>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-1 ${getHealthColor(analyticsData.financial.financialHealthScore)}`}>
                  <AlertCircle className="w-3 h-3" />
                  <span>{analyticsData.financial.financialHealthScore >= 80 ? 'Excellent' : analyticsData.financial.financialHealthScore >= 60 ? 'Good' : 'Needs Attention'}</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.revenue.revenueByMonth.map((month, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{month.month}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className="bg-info h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (month.revenue / analyticsData.revenue.totalRevenue) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(month.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Revenue by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.revenue.revenueByCategory.map((category, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          category.category === 'Services' ? 'bg-info' :
                          category.category === 'Products' ? 'bg-success' :
                          'bg-primary'
                        }`} />
                        <span className="text-sm">{category.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatPercentage(category.percentage)}</span>
                        <span className="text-sm">{formatCurrency(category.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Revenue Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.revenue.forecastedRevenue.map((forecast, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{forecast.period}</p>
                      <p className="text-sm text-muted-foreground">Confidence: {formatPercentage(forecast.confidence)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(forecast.forecast)}</p>
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-muted rounded-full h-1">
                          <div
                            className="bg-info h-1 rounded-full"
                            style={{ width: `${forecast.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Customers</span>
                    <span className="font-bold">{analyticsData.customers.totalCustomers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New This Month</span>
                    <span className="font-bold">{analyticsData.customers.newCustomersThisMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retention Rate</span>
                    <span className="font-bold">{formatPercentage(analyticsData.customers.customerRetentionRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Value</span>
                    <span className="font-bold">{formatCurrency(analyticsData.customers.averageCustomerValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Acquisition Cost</span>
                    <span className="font-bold">{formatCurrency(analyticsData.customers.customerAcquisitionCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.customers.topCustomersByRevenue.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{customer.name}</span>
                        <Badge variant="secondary">{formatPercentage(customer.percentage)}</Badge>
                      </div>
                      <span className="font-bold">{formatCurrency(customer.revenue)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Employee Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Employees</span>
                    <span className="font-bold">{analyticsData.employees.totalEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Employees</span>
                    <span className="font-bold">{analyticsData.employees.activeEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Salary</span>
                    <span className="font-bold">{formatCurrency(analyticsData.employees.averageSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Productivity</span>
                    <span className="font-bold">{formatCurrency(analyticsData.employees.employeeProductivity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Turnover Rate</span>
                    <span className="font-bold">{formatPercentage(analyticsData.employees.turnoverRate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employees by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.employees.employeesByDepartment.map((dept, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{dept.department}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (dept.count / analyticsData.employees.totalEmployees) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{dept.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Health Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded">
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                  <p className="text-lg font-bold">{formatPercentage(analyticsData.financial.profitMargin)}</p>
                </div>
                <div className="p-4 border rounded">
                  <p className="text-sm text-muted-foreground">Current Ratio</p>
                  <p className="text-lg font-bold">{analyticsData.financial.currentRatio.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded">
                  <p className="text-sm text-muted-foreground">Cash Flow</p>
                  <p className="text-lg font-bold">{formatCurrency(analyticsData.financial.cashFlow)}</p>
                </div>
                <div className="p-4 border rounded">
                  <p className="text-sm text-muted-foreground">Return on Assets</p>
                  <p className="text-lg font-bold">{formatPercentage(analyticsData.financial.returnOnAssets)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Support Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Tickets</span>
                    <span className="font-bold">{analyticsData.support.totalTickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Open Tickets</span>
                    <span className="font-bold">{analyticsData.support.openTickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolved Tickets</span>
                    <span className="font-bold">{analyticsData.support.resolvedTickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Resolution Time</span>
                    <span className="font-bold">{analyticsData.support.averageResolutionTime.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Satisfaction</span>
                    <span className="font-bold">{formatPercentage(analyticsData.support.customerSatisfaction)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tickets by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.support.ticketsByPriority.map((priority, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          priority.priority === 'High' ? 'bg-danger' :
                          priority.priority === 'Medium' ? 'bg-warning' :
                          'bg-success'
                        }`} />
                        <span className="text-sm">{priority.priority}</span>
                      </div>
                      <span className="font-bold">{priority.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Projects</span>
                    <span className="font-bold">{analyticsData.projects.totalProjects}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Projects</span>
                    <span className="font-bold">{analyticsData.projects.activeProjects}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Projects</span>
                    <span className="font-bold">{analyticsData.projects.completedProjects}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-bold">{formatPercentage(analyticsData.projects.projectSuccessRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Duration</span>
                    <span className="font-bold">{analyticsData.projects.averageProjectDuration.toFixed(1)} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.projects.projectsByStatus.map((status, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          status.status === 'Open' ? 'bg-info' :
                          status.status === 'Closed' ? 'bg-success' :
                          'bg-warning'
                        }`} />
                        <span className="text-sm">{status.status}</span>
                      </div>
                      <span className="font-bold">{status.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
