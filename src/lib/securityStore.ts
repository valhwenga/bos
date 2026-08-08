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

  // Authentication
  authenticate(email: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = this.list();
    console.log('SecurityStore.authenticate - Available users:', users);
    console.log('SecurityStore.authenticate - Looking for email:', email);
    
    const user = users.find(u => u.email === email && u.isActive);
    console.log('SecurityStore.authenticate - Found user:', user);

    if (!user) {
      this.logAudit('anonymous', 'LOGIN_FAILED', 'auth', false, { email, reason: 'USER_NOT_FOUND' });
      return { success: false, error: 'User not found' };
    }

    // In a real system, you'd hash passwords. For demo, using simple check
    const isCorrectPassword = 
      (email === 'admin@spiketech.co.za' && password === 'Password@00') ||
      (email !== 'admin@spiketech.co.za' && password === 'password');
      
    if (!isCorrectPassword) {
      this.logAudit(user.id, 'LOGIN_FAILED', 'auth', false, { reason: 'INVALID_PASSWORD' });
      return { success: false, error: 'Invalid password' };
    }

    // Update last login
    this.update(user.id, { lastLogin: new Date().toISOString() });

    // Create session
    const session: Session = {
      user,
      token: this.generateToken(),
      expiresAt: new Date(Date.now() + this.getSettings().sessionTimeout * 60 * 1000).toISOString(),
      loginTime: new Date().toISOString()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Log successful login
    this.logAudit(user.id, 'LOGIN_SUCCESS', 'auth', true);

    return { success: true, user };
  },

  logout(): void {
    const session = this.getCurrentSession();
    if (session) {
      this.logAudit(session.user.id, 'LOGOUT', 'auth', true);
    }
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent('auth-logout'));
  },

  getCurrentSession(): Session | null {
    try {
      const session = localStorage.getItem(SESSION_KEY);
      if (!session) return null;

      const sessionData = JSON.parse(session);
      
      // Check if session expired
      if (new Date() > new Date(sessionData.expiresAt)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return sessionData;
    } catch {
      return null;
    }
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
