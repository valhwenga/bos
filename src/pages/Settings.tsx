import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SecurityStore, UserRole } from '@/lib/securityStore';
import BackupManager from '@/components/BackupManager';
import UserManagement from '@/components/UserManagement';
import { Settings, Users, Shield, Database, Lock } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(SecurityStore.getCurrentSession()?.user);
  }, []);

  const canManageUsers = currentUser?.role === 'admin';
  const canManageBackups = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const tabs = [
    { id: 'users', label: 'Users', icon: Users, show: canManageUsers },
    { id: 'backup', label: 'Backup', icon: Database, show: canManageBackups },
    { id: 'security', label: 'Security', icon: Shield, show: canManageUsers },
  ].filter(tab => tab.show);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Settings className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">Manage system settings and user access</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && canManageUsers && <UserManagement />}
      {activeTab === 'backup' && canManageBackups && <BackupManager />}
      {activeTab === 'security' && canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded">
                <h3 className="font-medium mb-2">Current User</h3>
                <p>Name: {currentUser?.name}</p>
                <p>Role: <Badge variant="outline">{currentUser?.role}</Badge></p>
                <p>Email: {currentUser?.email}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Security features are active with role-based access control.</p>
                <p>Contact your administrator for security policy changes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
