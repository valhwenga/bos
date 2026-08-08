import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PriorityStore, PriorityTask, SystemAlert, HealthCheck } from '@/lib/priorityStore';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Shield, 
  Database, 
  Activity,
  Bell,
  Zap,
  AlertOctagon,
  TrendingUp,
  Users,
  Settings
} from 'lucide-react';

const HighPriorityDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<PriorityTask[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [summary, setSummary] = useState(PriorityStore.getPrioritySummary());

  useEffect(() => {
    // Load initial data
    setTasks(PriorityStore.getTasks());
    setAlerts(PriorityStore.getAlerts());
    setHealthChecks(PriorityStore.getHealthChecks());
    setSummary(PriorityStore.getPrioritySummary());

    // Set up event listeners
    const handleTaskCreated = (e: CustomEvent) => {
      setTasks(PriorityStore.getTasks());
      setSummary(PriorityStore.getPrioritySummary());
    };

    const handleAlertCreated = (e: CustomEvent) => {
      setAlerts(PriorityStore.getAlerts());
      setSummary(PriorityStore.getPrioritySummary());
    };

    const handleHealthUpdated = (e: CustomEvent) => {
      setHealthChecks(PriorityStore.getHealthChecks());
      setSummary(PriorityStore.getPrioritySummary());
    };

    window.addEventListener('priority-task-created', handleTaskCreated as EventListener);
    window.addEventListener('system-alert-created', handleAlertCreated as EventListener);
    window.addEventListener('health-check-updated', handleHealthUpdated as EventListener);

    return () => {
      window.removeEventListener('priority-task-created', handleTaskCreated as EventListener);
      window.removeEventListener('system-alert-created', handleAlertCreated as EventListener);
      window.removeEventListener('health-check-updated', handleHealthUpdated as EventListener);
    };
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'offline': return <AlertOctagon className="w-4 h-4 text-gray-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Activity className="w-4 h-4 text-blue-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    PriorityStore.acknowledgeAlert(alertId, 'current_user');
    setAlerts(PriorityStore.getAlerts());
    setSummary(PriorityStore.getPrioritySummary());
  };

  const updateTaskStatus = (taskId: string, status: PriorityTask['status']) => {
    PriorityStore.updateTask(taskId, { status });
    setTasks(PriorityStore.getTasks());
    setSummary(PriorityStore.getPrioritySummary());
  };

  const runHealthCheck = () => {
    // Simulate health checks
    PriorityStore.updateHealthCheck('Database', 'healthy', { responseTime: 45 });
    PriorityStore.updateHealthCheck('API', 'healthy', { responseTime: 120 });
    PriorityStore.updateHealthCheck('Storage', 'warning', { responseTime: 250, errorMessage: 'High disk usage' });
    PriorityStore.updateHealthCheck('Backup', 'healthy', { responseTime: 89 });
    
    setHealthChecks(PriorityStore.getHealthChecks());
    setSummary(PriorityStore.getPrioritySummary());
  };

  const createTestAlert = () => {
    PriorityStore.createAlert({
      type: 'warning',
      title: 'Test Alert',
      message: 'This is a test alert for the high-priority system',
      priority: 'high',
      category: 'system',
      requiresAction: false,
      acknowledged: false,
    });
    
    setAlerts(PriorityStore.getAlerts());
    setSummary(PriorityStore.getPrioritySummary());
  };

  const createCriticalTask = () => {
    PriorityStore.createCriticalTask(
      'Emergency System Maintenance',
      'Critical system update required immediately to prevent data loss',
      'system'
    );
    
    setTasks(PriorityStore.getTasks());
    setSummary(PriorityStore.getPrioritySummary());
  };

  return (
    <div className="space-y-6">
      {/* Priority Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Critical Tasks</p>
                <p className="text-2xl font-bold text-red-900">{summary.criticalTasks}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">High Priority</p>
                <p className="text-2xl font-bold text-orange-900">{summary.highTasks}</p>
              </div>
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700">Unacknowledged</p>
                <p className="text-2xl font-bold text-yellow-900">{summary.unacknowledgedAlerts}</p>
              </div>
              <Bell className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${
          summary.systemHealth === 'healthy' ? 'border-green-200 bg-green-50' :
          summary.systemHealth === 'warning' ? 'border-yellow-200 bg-yellow-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">System Health</p>
                <p className="text-lg font-bold capitalize">{summary.systemHealth}</p>
              </div>
              {getStatusIcon(summary.systemHealth)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {summary.criticalTasks > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Critical Alert:</strong> {summary.criticalTasks} critical tasks require immediate attention!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Priority Tasks
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={createCriticalTask}>
                Create Critical Task
              </Button>
              <Button size="sm" variant="outline" onClick={runHealthCheck}>
                Run Health Check
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{task.category}</span>
                    </div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value as PriorityTask['status'])}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No priority tasks</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              System Alerts
            </CardTitle>
            <Button size="sm" variant="outline" onClick={createTestAlert}>
              Create Test Alert
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className={`p-3 border rounded-lg ${alert.acknowledged ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.type)}
                      <Badge className={getPriorityColor(alert.priority)}>
                        {alert.priority}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{alert.category}</span>
                    </div>
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                  <p className="font-medium mt-2">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                    {alert.acknowledged && ` - Acknowledged by ${alert.acknowledgedBy}`}
                  </p>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No system alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {healthChecks.map(check => (
              <div key={check.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{check.component}</span>
                  {getStatusIcon(check.status)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Status: <span className="font-medium capitalize">{check.status}</span></p>
                  {check.responseTime && (
                    <p>Response: {check.responseTime}ms</p>
                  )}
                  {check.errorMessage && (
                    <p className="text-red-600">{check.errorMessage}</p>
                  )}
                  <p className="text-xs mt-1">
                    {new Date(check.lastChecked).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {healthChecks.length === 0 && (
              <div className="col-span-full text-center py-8">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No health checks available</p>
                <Button onClick={runHealthCheck} className="mt-4">
                  Initialize Health Monitoring
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HighPriorityDashboard;
