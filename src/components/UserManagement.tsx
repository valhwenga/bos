import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SecurityStore, User as UserType, UserRole } from '@/lib/securityStore';
import { Users, Shield, Edit, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'employee' as UserRole,
    permissions: [],
    isActive: true,
    twoFactorEnabled: false
  });

  useEffect(() => {
    loadUsers();
    setCurrentUser(SecurityStore.getCurrentSession()?.user || null);
  }, []);

  const loadUsers = () => {
    setUsers(SecurityStore.list());
  };

  const createUser = () => {
    try {
      SecurityStore.create(newUser);
      setNewUser({
        email: '',
        name: '',
        role: 'employee' as UserRole,
        permissions: [],
        isActive: true,
        twoFactorEnabled: false
      });
      setShowUserDialog(false);
      loadUsers();
      toast({
        title: "User Created",
        description: `User ${newUser.name} has been created successfully`,
      });
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: "Failed to create user",
        variant: "destructive"
      });
    }
  };

  const updateUser = () => {
    if (!editingUser) return;

    try {
      SecurityStore.update(editingUser.id, newUser);
      setEditingUser(null);
      setShowUserDialog(false);
      loadUsers();
      toast({
        title: "User Updated",
        description: `User ${newUser.name} has been updated successfully`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update user",
        variant: "destructive"
      });
    }
  };

  const deleteUser = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to delete user ${userName}? This action cannot be undone.`)) {
      try {
        SecurityStore.delete(userId);
        loadUsers();
        toast({
          title: "User Deleted",
          description: `User ${userName} has been deleted`,
        });
      } catch (error) {
        toast({
          title: "Deletion Failed",
          description: "Failed to delete user",
          variant: "destructive"
        });
      }
    }
  };

  const toggleUserStatus = (user: UserType) => {
    try {
      SecurityStore.update(user.id, { isActive: !user.isActive });
      loadUsers();
      toast({
        title: "Status Updated",
        description: `User ${user.name} has been ${!user.isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update user status",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (user: UserType) => {
    setEditingUser(user);
    setNewUser({
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled
    });
    setShowUserDialog(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setNewUser({
      email: '',
      name: '',
      role: 'employee' as UserRole,
      permissions: [],
      isActive: true,
      twoFactorEnabled: false
    });
    setShowUserDialog(true);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'employee': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  };

  const canManageUsers = currentUser?.role === 'admin';

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </div>
            {canManageUsers && (
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No users found</p>
              <p className="text-sm text-muted-foreground">
                {canManageUsers ? 'Create your first user to get started' : 'Contact an administrator to add users'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.isActive ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Shield className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          <Badge variant={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                          {!user.isActive && (
                            <Badge variant="destructive" className="ml-2">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.lastLogin && (
                          <p className="text-xs text-muted-foreground">
                            Last login: {new Date(user.lastLogin).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageUsers && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteUser(user.id, user.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                placeholder="Enter full name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">User Role</Label>
              <Select 
                value={newUser.role} 
                onValueChange={(value: UserRole) => setNewUser({...newUser, role: value})}
                disabled={!canManageUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Read only access</SelectItem>
                  <SelectItem value="employee">Employee - Basic access</SelectItem>
                  <SelectItem value="manager">Manager - Full access</SelectItem>
                  <SelectItem value="admin">Admin - System administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Role Permissions</Label>
              <div className="p-3 bg-muted rounded text-sm">
                <p className="font-medium mb-2">
                  {newUser.role === 'admin' && 'Full system access including user management'}
                  {newUser.role === 'manager' && 'Can create, edit, delete invoices, payments, customers, and view reports'}
                  {newUser.role === 'employee' && 'Can create invoices, process payments, and manage customers'}
                  {newUser.role === 'viewer' && 'Read-only access to invoices, payments, and customer data'}
                </p>
                <div className="space-y-1">
                  {SecurityStore.getRolePermissions(newUser.role).slice(0, 5).map(permission => (
                    <Badge key={permission} variant="outline" className="mr-1">
                      {permission}
                    </Badge>
                  ))}
                  {SecurityStore.getRolePermissions(newUser.role).length > 5 && (
                    <Badge variant="outline">+{SecurityStore.getRolePermissions(newUser.role).length - 5} more</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={newUser.isActive}
                onChange={(e) => setNewUser({...newUser, isActive: e.target.checked})}
              />
              <Label htmlFor="isActive">Account Active</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="twoFactor"
                checked={newUser.twoFactorEnabled}
                onChange={(e) => setNewUser({...newUser, twoFactorEnabled: e.target.checked})}
              />
              <Label htmlFor="twoFactor">Enable Two-Factor Authentication</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingUser ? updateUser : createUser}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
