export interface PriorityTask {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'system' | 'security' | 'backup' | 'user' | 'financial';
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  resolvedAt?: string;
  resolution?: string;
  impact: 'minimal' | 'moderate' | 'significant' | 'critical';
  requiresAction: boolean;
}

export interface SystemAlert {
  id: string;
  type: 'emergency' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'system' | 'security' | 'backup' | 'performance' | 'user';
  requiresAction: boolean;
  actionUrl?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface HealthCheck {
  id: string;
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastChecked: string;
  responseTime?: number;
  errorMessage?: string;
  metrics?: Record<string, any>;
}

const PRIORITY_TASKS_KEY = 'priority_tasks';
const SYSTEM_ALERTS_KEY = 'system_alerts';
const HEALTH_CHECKS_KEY = 'health_checks';

export const PriorityStore = {
  // Priority Tasks Management
  getTasks(): PriorityTask[] {
    try {
      const tasks = localStorage.getItem(PRIORITY_TASKS_KEY);
      return tasks ? JSON.parse(tasks) : [];
    } catch {
      return [];
    }
  },

  createTask(task: Omit<PriorityTask, 'id' | 'createdAt'>): PriorityTask {
    const newTask: PriorityTask = {
      ...task,
      id: `task_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const tasks = this.getTasks();
    tasks.unshift(newTask);
    localStorage.setItem(PRIORITY_TASKS_KEY, JSON.stringify(tasks));

    // Trigger event
    window.dispatchEvent(new CustomEvent('priority-task-created', { detail: newTask }));

    return newTask;
  },

  updateTask(id: string, updates: Partial<PriorityTask>): PriorityTask | null {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    
    if (index === -1) return null;

    tasks[index] = { ...tasks[index], ...updates };
    localStorage.setItem(PRIORITY_TASKS_KEY, JSON.stringify(tasks));

    // Trigger event
    window.dispatchEvent(new CustomEvent('priority-task-updated', { detail: tasks[index] }));

    return tasks[index];
  },

  deleteTask(id: string): boolean {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    
    if (filtered.length === tasks.length) return false;

    localStorage.setItem(PRIORITY_TASKS_KEY, JSON.stringify(filtered));

    // Trigger event
    window.dispatchEvent(new CustomEvent('priority-task-deleted', { detail: { id } }));

    return true;
  },

  getTasksByPriority(priority: PriorityTask['priority']): PriorityTask[] {
    return this.getTasks().filter(task => task.priority === priority);
  },

  getCriticalTasks(): PriorityTask[] {
    return this.getTasksByPriority('critical').filter(task => 
      task.status !== 'completed' && task.requiresAction
    );
  },

  // System Alerts Management
  getAlerts(): SystemAlert[] {
    try {
      const alerts = localStorage.getItem(SYSTEM_ALERTS_KEY);
      return alerts ? JSON.parse(alerts) : [];
    } catch {
      return [];
    }
  },

  createAlert(alert: Omit<SystemAlert, 'id' | 'timestamp'>): SystemAlert {
    const newAlert: SystemAlert = {
      ...alert,
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    const alerts = this.getAlerts();
    alerts.unshift(newAlert);

    // Keep only last 100 alerts
    if (alerts.length > 100) {
      alerts.splice(100);
    }

    localStorage.setItem(SYSTEM_ALERTS_KEY, JSON.stringify(alerts));

    // Trigger events
    window.dispatchEvent(new CustomEvent('system-alert-created', { detail: newAlert }));
    
    if (alert.priority === 'critical') {
      window.dispatchEvent(new CustomEvent('critical-alert', { detail: newAlert }));
    }

    return newAlert;
  },

  acknowledgeAlert(id: string, acknowledgedBy: string): boolean {
    const alerts = this.getAlerts();
    const index = alerts.findIndex(a => a.id === id);
    
    if (index === -1) return false;

    alerts[index] = {
      ...alerts[index],
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
    };

    localStorage.setItem(SYSTEM_ALERTS_KEY, JSON.stringify(alerts));

    // Trigger event
    window.dispatchEvent(new CustomEvent('alert-acknowledged', { detail: alerts[index] }));

    return true;
  },

  getUnacknowledgedAlerts(): SystemAlert[] {
    return this.getAlerts().filter(alert => !alert.acknowledged);
  },

  getCriticalAlerts(): SystemAlert[] {
    return this.getAlerts().filter(alert => 
      alert.priority === 'critical' && !alert.acknowledged
    );
  },

  // Health Checks Management
  getHealthChecks(): HealthCheck[] {
    try {
      const checks = localStorage.getItem(HEALTH_CHECKS_KEY);
      return checks ? JSON.parse(checks) : [];
    } catch {
      return [];
    }
  },

  updateHealthCheck(component: string, status: HealthCheck['status'], metrics?: Record<string, any>): HealthCheck {
    const checks = this.getHealthChecks();
    const existing = checks.find(c => c.component === component);

    const healthCheck: HealthCheck = {
      id: existing?.id || `health_${Date.now()}`,
      component,
      status,
      lastChecked: new Date().toISOString(),
      responseTime: metrics?.responseTime,
      errorMessage: metrics?.errorMessage,
      metrics,
    };

    if (existing) {
      const index = checks.findIndex(c => c.id === existing.id);
      checks[index] = healthCheck;
    } else {
      checks.push(healthCheck);
    }

    localStorage.setItem(HEALTH_CHECKS_KEY, JSON.stringify(checks));

    // Trigger event
    window.dispatchEvent(new CustomEvent('health-check-updated', { detail: healthCheck }));

    return healthCheck;
  },

  getSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const checks = this.getHealthChecks();
    
    if (checks.some(c => c.status === 'critical' || c.status === 'offline')) {
      return 'critical';
    }
    
    if (checks.some(c => c.status === 'warning')) {
      return 'warning';
    }
    
    return 'healthy';
  },

  // Emergency Operations
  triggerEmergencyAlert(title: string, message: string, category: SystemAlert['category']): SystemAlert {
    return this.createAlert({
      type: 'emergency',
      title,
      message,
      priority: 'critical',
      category,
      requiresAction: true,
      acknowledged: false,
    });
  },

  createCriticalTask(title: string, description: string, category: PriorityTask['category']): PriorityTask {
    return this.createTask({
      title,
      description,
      priority: 'critical',
      category,
      status: 'pending',
      createdBy: 'system',
      impact: 'critical',
      requiresAction: true,
      dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    });
  },

  // Priority Summary
  getPrioritySummary(): {
    criticalTasks: number;
    highTasks: number;
    unacknowledgedAlerts: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  } {
    const tasks = this.getTasks();
    const alerts = this.getAlerts();

    return {
      criticalTasks: tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length,
      highTasks: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
      unacknowledgedAlerts: alerts.filter(a => !a.acknowledged).length,
      systemHealth: this.getSystemHealth(),
    };
  },
};
