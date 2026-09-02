import { getSession } from "./session";
export type UserRole = 'admin' | 'manager' | 'employee' | 'viewer';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  lastLogin?: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  user: User;
  token: string;
  expiresAt: string;
  loginTime: string;
};

export type AuditLog = {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: any;
};

export type SecuritySettings = {
  passwordMinLength: number;
  requireTwoFactor: boolean;
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
  auditRetention: number; // days
};

const USERS_KEY = 'security_users';
const SESSION_KEY = 'security_session';
const AUDIT_KEY = 'security_audit';
const SETTINGS_KEY = 'security_settings';

const DEFAULT_SETTINGS: SecuritySettings = {
  passwordMinLength: 8,
  requireTwoFactor: false,
  sessionTimeout: 480, // 8 hours
  maxLoginAttempts: 5,
  lockoutDuration: 30, // 30 minutes
  auditRetention: 90 // 90 days
};

export const SecurityStore = {
  // User Management
  list(): User[] {
    try {
      const users = localStorage.getItem(USERS_KEY);
      console.log('SecurityStore.list - Raw localStorage data:', users);
      const parsed = users ? JSON.parse(users) : [];
      console.log('SecurityStore.list - Parsed users:', parsed);
      return parsed;
    } catch {
      return [];
    }
  },

  get(id: string): User | undefined {
    return this.list().find(u => u.id === id);
  },

  create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    console.log('SecurityStore.create - Creating user:', userData);
    const user: User = {
      id: `user_${Date.now()}`,
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const users = this.list();
    console.log('SecurityStore.create - Current users before adding:', users);
    users.push(user);
    console.log('SecurityStore.create - Users after adding:', users);
    
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    console.log('SecurityStore.create - Saved to localStorage with key:', USERS_KEY);
    
    // Verify it was saved
    const saved = localStorage.getItem(USERS_KEY);
    console.log('SecurityStore.create - Verification - saved data:', saved);

    // Log user creation
    this.logAudit(user.id, 'USER_CREATED', 'users', true, { email: user.email, role: user.role });

    return user;
  },

  update(id: string, updates: Partial<User>): User | null {
    const users = this.list();
    const index = users.findIndex(u => u.id === id);
    
    if (index === -1) return null;

    const updatedUser = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
    users[index] = updatedUser;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Log user update
    this.logAudit(id, 'USER_UPDATED', 'users', true, updates);

    return updatedUser;
  },

  delete(id: string): boolean {
    const users = this.list();
    const filtered = users.filter(u => u.id !== id);
    
    if (filtered.length === users.length) return false;

    localStorage.setItem(USERS_KEY, JSON.stringify(filtered));

    // Log user deletion
    this.logAudit(id, 'USER_DELETED', 'users', true);

    return true;
  },

  // Authentication lives in authStore/Supabase now.
  //
  // This module used to carry a second, parallel sign-in with the password
  // check written into the source: the admin address matched one literal, and
  // *every other address* was accepted with the password "password". It also
  // logged the full user list to the console on each attempt. It was only
  // reachable from a login component that was never routed, but an exported
  // backdoor is one route away from being live, so it is gone rather than
  // merely disconnected.

  /**
   * The signed-in user, shaped like the old session object so the dashboards
   * that read `session.user.id` and `.name` keep working. It reflects the real
   * Supabase session rather than a separate one kept in localStorage, which
   * could disagree with who was actually signed in.
   */
  getCurrentSession(): Session | null {
    const snap = getSession();
    if (snap.status !== "signed-in" || !snap.profile) return null;
    return {
      user: {
        id: snap.profile.id,
        email: snap.profile.email,
        name: snap.profile.name,
        role: "employee",
        permissions: [],
        isActive: snap.profile.status === "active",
        twoFactorEnabled: false,
        createdAt: "",
        updatedAt: "",
      },
      token: snap.session?.access_token ?? "",
      expiresAt: snap.session?.expires_at
        ? new Date(snap.session.expires_at * 1000).toISOString()
        : "",
      loginTime: "",
    };
  },

  // Authorization
  hasPermission(permission: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    return session.user.permissions.includes(permission) || session.user.role === 'admin';
  },

  requireRole(role: UserRole): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    return session.user.role === role || session.user.role === 'admin';
  },

  // Audit Trail
  logAudit(userId: string, action: string, resource: string, success: boolean, details?: any): void {
    const logs = this.getAuditLogs();
    const log: AuditLog = {
      id: `audit_${Date.now()}`,
      userId,
      action,
      resource,
      timestamp: new Date().toISOString(),
      ipAddress: 'localhost', // In production, get real IP
      userAgent: navigator.userAgent,
      success,
      details
    };

    logs.unshift(log);

    // Keep only logs within retention period
    const settings = this.getSettings();
    const cutoffDate = new Date(Date.now() - settings.auditRetention * 24 * 60 * 60 * 1000);
    const filteredLogs = logs.filter(log => new Date(log.timestamp) > cutoffDate);

    localStorage.setItem(AUDIT_KEY, JSON.stringify(filteredLogs));
  },

  getAuditLogs(): AuditLog[] {
    try {
      const logs = localStorage.getItem(AUDIT_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  },

  // Settings
  getSettings(): SecuritySettings {
    try {
      const settings = localStorage.getItem(SETTINGS_KEY);
      return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  updateSettings(updates: Partial<SecuritySettings>): SecuritySettings {
    const current = this.getSettings();
    const newSettings = { ...current, ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    return newSettings;
  },

  // Utility functions
  generateToken(): string {
    return btoa(Math.random().toString(36).substring(2) + Date.now().toString(36));
  },

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const settings = this.getSettings();

    if (password.length < settings.passwordMinLength) {
      errors.push(`Password must be at least ${settings.passwordMinLength} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Role-based permissions
  getRolePermissions(role: UserRole): string[] {
    const permissions = {
      admin: ['*'], // All permissions
      manager: [
        'invoices.create', 'invoices.read', 'invoices.update', 'invoices.delete',
        'payments.create', 'payments.read', 'payments.update',
        'customers.create', 'customers.read', 'customers.update', 'customers.delete',
        'reports.read', 'users.read', 'dashboard.read'
      ],
      employee: [
        'invoices.create', 'invoices.read', 'invoices.update',
        'payments.create', 'payments.read',
        'customers.read', 'customers.update',
        'dashboard.read'
      ],
      viewer: [
        'invoices.read', 'payments.read', 'customers.read', 'dashboard.read'
      ]
    };

    return permissions[role] || [];
  }
};
