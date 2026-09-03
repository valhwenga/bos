import { CompanySettingsStore } from "./companySettings";
import { AccountingStore } from "./accountingStore";
import { PaymentStore } from "./paymentStore";
import { UsersStore } from "./usersStore";
import { CustomersStore } from "./customersStore";
import { ProductsStore } from "./productsStore";
import { SupportStore } from "./supportStore";
import { ProjectStore } from "./projectStore";
import { HRMDepartmentsStore } from "./hrmDepartmentsStore";
import { CommunicationStore } from "./communicationStore";
import { SecurityStore } from "./securityStore";
import { CrmDealsStore } from "./crmDealsStore";
import { CrmCustomersStore } from "./crmCustomersStore";
import { CrmLeadsStore } from "./crmLeadsStore";
import { CrmTasksStore } from "./crmTasksStore";
import { DocumentStore } from "./documentStore";
import { EmailStore } from "./emailStore";
import { EmployeeDocumentsStore } from "./employeeDocumentsStore";
import { ExpenseStore } from "./expenseStore";
import { HRMLeaveStore } from "./hrmLeaveStore";
import { HRMPerformanceStore } from "./hrmPerformanceStore";
import { HRMStore } from "./hrmStore";
import { LeaveBalanceStore } from "./leaveBalanceStore";
import { MessengerStore } from "./messengerStore";
import { NotificationsStore } from "./notificationsStore";
import { PayrollStore } from "./payrollStore";
import { PriorityStore } from "./priorityStore";
import { RecurringStore } from "./recurringStore";
import { RolesStore } from "./rolesStore";
import { SalesStore } from "./salesStore";
import { UserStore } from "./userStore";
import { WhatsAppStore } from "./whatsappStore";
import { WorkflowStore } from "./workflowStore";
import { AnalyticsStore } from "./analyticsStore";
import { AuditLogStore } from "./auditLogStore";
import { AuditStore } from "./auditStore";
import { AuthStore } from "./authStore";
import { CreditNotesStore } from "./creditNotesStore";

export type BackupData = {
  version: string;
  timestamp: string;
  metadata: {
    totalItems: number;
    totalSize: string;
    storesBackedUp: string[];
  };
  // Company Settings
  company: any;
  // Accounting
  invoices: any[];
  quotes: any[];
  payments: any[];
  creditNotes: any[];
  // Core Data
  users: any[];
  customers: any[];
  products: any[];
  // Projects & Support
  support: any[];
  projects: any[];
  // HRM
  departments: any[];
  employees: any[];
  leaveRequests: any[];
  performance: any[];
  payroll: any[];
  leaveBalances: any[];
  employeeDocuments: any[];
  // Communication
  communication: {
    messages: any[];
    conversations: any[];
    workspaces: any[];
    meetings: any[];
    calendars: any[];
    notifications: any[];
    directMessages: any[];
    users: any[];
  };
  // Security
  security: {
    users: any[];
    session: any;
    auditLogs: any[];
    settings: any;
  };
  // CRM
  crm: {
    deals: any[];
    customers: any[];
    leads: any[];
    tasks: any[];
  };
  // Other
  documents: any[];
  emails: any[];
  expenses: any[];
  messenger: any[];
  notifications: any[];
  priorities: any[];
  recurring: any[];
  roles: any[];
  sales: any[];
  whatsapp: any[];
  workflows: any[];
  analytics: any[];
  auditLogs: any[];
  audits: any[];
  auth: any[];
  // Full localStorage backup (for complete restore)
  fullLocalStorage: Record<string, any>;
};

export type BackupSchedule = {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastBackup: string;
  autoBackup: boolean;
};

const BACKUP_KEY = 'system_backups';
const SCHEDULE_KEY = 'backup_schedule';
const MAX_BACKUPS = 10;

export const BackupStore = {
  // Get all backups
  list(): BackupData[] {
    try {
      const backups = localStorage.getItem(BACKUP_KEY);
      return backups ? JSON.parse(backups) : [];
    } catch {
      return [];
    }
  },

  // Create backup
  create(): BackupData {
    // Collect all localStorage keys for full backup
    const fullLocalStorage: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          fullLocalStorage[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          fullLocalStorage[key] = localStorage.getItem(key);
        }
      }
    }

    const storesBackedUp = [
      'company', 'invoices', 'quotes', 'payments', 'creditNotes',
      'users', 'customers', 'products', 'support', 'projects',
      'departments', 'employees', 'leaveRequests', 'performance',
      'payroll', 'leaveBalances', 'employeeDocuments', 'communication',
      'security', 'crm', 'documents', 'emails', 'expenses',
      'messenger', 'notifications', 'priorities', 'recurring',
      'roles', 'sales', 'whatsapp', 'workflows', 'analytics',
      'auditLogs', 'audits', 'auth', 'fullLocalStorage'
    ];

    const backup: BackupData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      metadata: {
        totalItems: Object.keys(fullLocalStorage).length,
        totalSize: `${(JSON.stringify(fullLocalStorage).length / 1024).toFixed(2)} KB`,
        storesBackedUp
      },
      // Company Settings
      company: CompanySettingsStore.get(),
      // Accounting
      invoices: AccountingStore.listInvoices(),
      quotes: AccountingStore.listQuotes(),
      payments: PaymentStore.list(),
      creditNotes: CreditNotesStore.list(),
      // Core Data
      users: UsersStore.list(),
      customers: CustomersStore.list(),
      products: ProductsStore.list(),
      // Projects & Support
      support: SupportStore.list(),
      projects: ProjectStore.listProjects(),
      // HRM
      departments: HRMDepartmentsStore.list(),
      employees: HRMStore.list(),
      leaveRequests: HRMLeaveStore.list(),
      performance: HRMPerformanceStore.list(),
      payroll: PayrollStore.list(),
      leaveBalances: [], // No list method, handled by fullLocalStorage
      // Documents are files in private object storage now, not rows this can
      // serialise. They are covered by the database and storage backups, not by
      // this export.
      employeeDocuments: [],
      // Communication
      communication: {
        messages: CommunicationStore.getMessages(),
        conversations: CommunicationStore.getConversations(),
        workspaces: CommunicationStore.getWorkspaces(),
        meetings: CommunicationStore.getMeetings(),
        calendars: CommunicationStore.getCalendars(),
        notifications: CommunicationStore.getNotifications(),
        directMessages: CommunicationStore.getDirectMessages(),
        users: CommunicationStore.getUsers()
      },
      // Security
      security: {
        users: SecurityStore.list(),
        session: SecurityStore.getCurrentSession(),
        auditLogs: AuditLogStore.list(),
        settings: SecurityStore.getSettings()
      },
      // CRM
      crm: {
        deals: CrmDealsStore.list(),
        customers: CrmCustomersStore.list(),
        leads: CrmLeadsStore.list(),
        tasks: CrmTasksStore.list()
      },
      // Other - skip stores without list method, handled by fullLocalStorage
      documents: [],
      emails: [],
      expenses: ExpenseStore.list(),
      messenger: [],
      notifications: [],
      priorities: [],
      recurring: RecurringStore.list(),
      roles: RolesStore.list(),
      sales: SalesStore.list(),
      whatsapp: [],
      workflows: [],
      analytics: [],
      auditLogs: [],
      audits: AuditLogStore.list(),
      auth: [],
      // Full localStorage backup for complete restore
      fullLocalStorage
    };

    const backups = this.list();
    backups.unshift(backup);
    
    // Keep only last MAX_BACKUPS
    if (backups.length > MAX_BACKUPS) {
      backups.splice(MAX_BACKUPS);
    }

    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
    
    // Trigger backup event
    window.dispatchEvent(new CustomEvent('backup-created', { detail: backup }));
    
    return backup;
  },

  // Restore from backup
  /**
   * Restores a backup.
   *
   * Note this only covers what the app still keeps in the browser. Accounting,
   * HR, payroll and settings are rows in Postgres now and are covered by the
   * database's own backups — restoring here does not bring them back. See
   * DEPLOYMENT.md.
   */
  async restore(backupId: string): Promise<boolean> {
    try {
      const backups = this.list();
      const backup = backups.find(b => b.timestamp === backupId);
      
      if (!backup) {
        throw new Error('Backup not found');
      }

      // If backup has full localStorage, restore everything at once
      if (backup.fullLocalStorage) {
        // Clear current localStorage
        localStorage.clear();
        
        // Restore all keys from backup
        for (const [key, value] of Object.entries(backup.fullLocalStorage)) {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (e) {
            console.error(`Failed to restore key ${key}:`, e);
          }
        }
      } else {
        // Fallback: restore individual stores (legacy format)
        await CompanySettingsStore.set(backup.company);
        localStorage.setItem('acct.invoices', JSON.stringify(backup.invoices));
        localStorage.setItem('acct.quotes', JSON.stringify(backup.quotes));
        localStorage.setItem('payments', JSON.stringify(backup.payments));
        localStorage.setItem('users', JSON.stringify(backup.users));
        localStorage.setItem('customers', JSON.stringify(backup.customers));
        localStorage.setItem('products', JSON.stringify(backup.products));
        localStorage.setItem('support.tickets', JSON.stringify(backup.support));
        localStorage.setItem('proj.projects', JSON.stringify(backup.projects));
        localStorage.setItem('hrm.departments', JSON.stringify(backup.departments));
      }

      // Trigger restore event
      window.dispatchEvent(new CustomEvent('backup-restored', { detail: backup }));
      
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  },

  // Delete backup
  delete(backupId: string): void {
    const backups = this.list();
    const filtered = backups.filter(b => b.timestamp !== backupId);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(filtered));
  },

  // Export backup as file
  export(backupId: string): void {
    const backups = this.list();
    const backup = backups.find(b => b.timestamp === backupId);
    
    if (!backup) {
      throw new Error('Backup not found');
    }

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${new Date(backup.timestamp).toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Import backup from file
  import(file: File): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          
          // Validate backup structure
          if (!data.version || !data.timestamp) {
            throw new Error('Invalid backup format');
          }
          
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  // Get backup schedule
  getSchedule(): BackupSchedule {
    try {
      const schedule = localStorage.getItem(SCHEDULE_KEY);
      return schedule ? JSON.parse(schedule) : {
        enabled: false,
        frequency: 'weekly',
        lastBackup: '',
        autoBackup: false
      };
    } catch {
      return {
        enabled: false,
        frequency: 'weekly',
        lastBackup: '',
        autoBackup: false
      };
    }
  },

  // Set backup schedule
  setSchedule(schedule: BackupSchedule): void {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  },

  // Get backup size
  getBackupSize(): string {
    const backups = this.list();
    const size = JSON.stringify(backups).length;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  },

  // Check if backup needed
  shouldBackup(): boolean {
    const schedule = this.getSchedule();
    if (!schedule.enabled || !schedule.autoBackup) return false;
    
    const lastBackup = schedule.lastBackup ? new Date(schedule.lastBackup) : new Date(0);
    const now = new Date();
    
    switch (schedule.frequency) {
      case 'daily':
        return now.getDate() !== lastBackup.getDate() || 
               now.getMonth() !== lastBackup.getMonth() || 
               now.getFullYear() !== lastBackup.getFullYear();
      case 'weekly':
        const weekDiff = Math.floor((now.getTime() - lastBackup.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weekDiff >= 1;
      case 'monthly':
        return now.getMonth() !== lastBackup.getMonth() || 
               now.getFullYear() !== lastBackup.getFullYear();
      default:
        return false;
    }
  }
};
