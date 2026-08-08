import { SecurityStore } from './securityStore';

// Debug access issues
export const debugAccess = () => {
  console.log('=== DEBUG ACCESS ===');
  
  // Check current session
  const session = SecurityStore.getCurrentSession();
  console.log('Current Session:', session);
  
  if (session) {
    console.log('Logged in as:', session.user.email);
    console.log('User role:', session.user.role);
    console.log('User permissions:', session.user.permissions);
    
    // Check dashboard permission
    const hasDashboardPermission = SecurityStore.hasPermission('dashboard.read');
    console.log('Has dashboard.read permission:', hasDashboardPermission);
    
    // Check if admin
    const isAdmin = session.user.role === 'admin';
    console.log('Is admin:', isAdmin);
    
    // Final access check
    const canAccess = isAdmin || hasDashboardPermission;
    console.log('Can access dashboard:', canAccess);
  } else {
    console.log('No active session found');
  }
  
  // List all users
  const users = SecurityStore.list();
  console.log('All users:', users.map(u => ({
    email: u.email,
    role: u.role,
    permissions: u.permissions,
    isActive: u.isActive
  })));
  
  console.log('=== END DEBUG ===');
};

// Auto-run debug
if (typeof window !== 'undefined') {
  setTimeout(debugAccess, 1000);
}
