import { SecurityStore } from './securityStore';

// Initialize default users for the system
export const initializeDefaultUsers = () => {
  const existingUsers = SecurityStore.list();
  
  // Only create default users if no users exist
  if (existingUsers.length === 0) {
    console.log('Creating default users...');
    
    // Create specific Admin user
    const admin = SecurityStore.create({
      email: 'admin@spiketech.co.za',
      name: 'SpikeTech Administrator',
      role: 'admin',
      permissions: SecurityStore.getRolePermissions('admin'),
      isActive: true,
      twoFactorEnabled: false
    });
    
    // Create additional default users
    const manager = SecurityStore.create({
      email: 'manager@company.com',
      name: 'Office Manager',
      role: 'manager',
      permissions: SecurityStore.getRolePermissions('manager'),
      isActive: true,
      twoFactorEnabled: false
    });
    
    const employee = SecurityStore.create({
      email: 'employee@company.com',
      name: 'Sales Employee',
      role: 'employee',
      permissions: SecurityStore.getRolePermissions('employee'),
      isActive: true,
      twoFactorEnabled: false
    });
    
    const viewer = SecurityStore.create({
      email: 'viewer@company.com',
      name: 'Report Viewer',
      role: 'viewer',
      permissions: SecurityStore.getRolePermissions('viewer'),
      isActive: true,
      twoFactorEnabled: false
    });
    
    console.log('Default users created:');
    console.log('Admin: admin@spiketech.co.za (password: Password@00)');
    console.log('Manager: manager@company.com (password: password)');
    console.log('Employee: employee@company.com (password: password)');
    console.log('Viewer: viewer@company.com (password: password)');
    
    return { admin, manager, employee, viewer };
  }
  
  // Check if specific admin user exists, if not create it
  const spikeTechAdmin = existingUsers.find(u => u.email === 'admin@spiketech.co.za');
  if (!spikeTechAdmin) {
    console.log('Creating SpikeTech admin user...');
    const admin = SecurityStore.create({
      email: 'admin@spiketech.co.za',
      name: 'SpikeTech Administrator',
      role: 'admin',
      permissions: SecurityStore.getRolePermissions('admin'),
      isActive: true,
      twoFactorEnabled: false
    });
    
    console.log('SpikeTech admin created:');
    console.log('Admin: admin@spiketech.co.za (password: Password@00)');
    
    return admin;
  }
  
  return null;
};

// Initialize when this module is imported
if (typeof window !== 'undefined') {
  initializeDefaultUsers();
}
