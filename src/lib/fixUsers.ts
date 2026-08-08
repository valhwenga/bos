import { SecurityStore } from './securityStore';

// Fix user permissions by recreating users with correct permissions
export const fixUserPermissions = () => {
  console.log('Fixing user permissions...');
  
  // Clear existing users
  localStorage.removeItem('security_users');
  localStorage.removeItem('security_session');
  
  // Recreate users with correct permissions
  const admin = SecurityStore.create({
    email: 'admin@spiketech.co.za',
    name: 'SpikeTech Administrator',
    role: 'admin',
    permissions: SecurityStore.getRolePermissions('admin'),
    isActive: true,
    twoFactorEnabled: false
  });
  console.log('Created admin user:', admin);
  
  const manager = SecurityStore.create({
    email: 'manager@company.com',
    name: 'Office Manager',
    role: 'manager',
    permissions: SecurityStore.getRolePermissions('manager'),
    isActive: true,
    twoFactorEnabled: false
  });
  console.log('Created manager user:', manager);
  
  const employee = SecurityStore.create({
    email: 'employee@company.com',
    name: 'Sales Employee',
    role: 'employee',
    permissions: SecurityStore.getRolePermissions('employee'),
    isActive: true,
    twoFactorEnabled: false
  });
  console.log('Created employee user:', employee);
  
  const viewer = SecurityStore.create({
    email: 'viewer@company.com',
    name: 'Report Viewer',
    role: 'viewer',
    permissions: SecurityStore.getRolePermissions('viewer'),
    isActive: true,
    twoFactorEnabled: false
  });
  console.log('Created viewer user:', viewer);
  
  // Verify users were created
  const allUsers = SecurityStore.list();
  console.log('All users in SecurityStore after creation:', allUsers);
  
  console.log('Users recreated with correct permissions:');
  console.log('Admin: admin@spiketech.co.za (password: Password@00)');
  console.log('Manager: manager@company.com (password: password)');
  console.log('Employee: employee@company.com (password: password)');
  console.log('Viewer: viewer@company.com (password: password)');
  
  return { admin, manager, employee, viewer };
};

// Auto-fix when imported
if (typeof window !== 'undefined') {
  // Wait for everything to be loaded before fixing users
  setTimeout(() => {
    try {
      console.log('Auto-fixing user permissions...');
      fixUserPermissions();
      console.log('User permissions fixed successfully');
    } catch (error) {
      console.error('Failed to fix user permissions:', error);
    }
  }, 100);
  
  // Also expose manual fix function to window for debugging
  (window as any).fixUsersManually = () => {
    console.log('Manually fixing user permissions...');
    try {
      fixUserPermissions();
      console.log('Manual user permissions fix completed');
      console.log('Available users:');
      console.log('- Admin: admin@spiketech.co.za / Password@00');
      console.log('- Manager: manager@company.com / password');
      console.log('- Employee: employee@company.com / password');
      console.log('- Viewer: viewer@company.com / password');
    } catch (error) {
      console.error('Manual fix failed:', error);
    }
  };
  
  console.log('Manual fix function available: window.fixUsersManually()');
}
