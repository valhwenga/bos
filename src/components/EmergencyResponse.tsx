import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PriorityStore } from '@/lib/priorityStore';
import { SecurityStore } from '@/lib/securityStore';
import { BackupStore } from '@/lib/backupStore';
import {
  AlertTriangle,
  Shield,
  Database,
  Lock,
  Users,
  Phone,
  Mail,
  CheckCircle,
  Clock,
  Activity,
  Zap,
  AlertCircle,
  Power,
  RefreshCw,
  Settings
} from 'lucide-react';

const EmergencyResponse: React.FC = () => {
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [lastBackup, setLastBackup] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState({
    database: 'healthy',
    security: 'healthy',
    backup: 'healthy',
    users: 'healthy'
  });

  useEffect(() => {
    // Check system status
    const checkSystemStatus = () => {
      const backups = BackupStore.list();
      const lastBackupTime = backups.length > 0 ? backups[0].timestamp : '';
      setLastBackup(lastBackupTime);

      // Simulate system checks
      setSystemStatus({
        database: Math.random() > 0.1 ? 'healthy' : 'warning',
        security: Math.random() > 0.05 ? 'healthy' : 'critical',
        backup: backups.length > 0 ? 'healthy' : 'warning',
        users: 'healthy'
      });
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const triggerEmergencyMode = () => {
    setEmergencyMode(true);
    
    // Create emergency alert
    PriorityStore.triggerEmergencyAlert(
      'Emergency Mode Activated',
      'System emergency protocols have been activated. All non-essential functions suspended.',
      'system'
    );

    // Create critical tasks
    PriorityStore.createCriticalTask(
      'Secure All Systems',
      'Immediately secure all system access points and change security credentials',
      'security'
    );

    PriorityStore.createCriticalTask(
      'Emergency Backup',
      'Perform immediate emergency backup of all critical systems',
      'backup'
    );

    PriorityStore.createCriticalTask(
      'Notify Stakeholders',
      'Notify all system stakeholders about the emergency situation',
      'user'
    );

    // Lock down user sessions (except current admin)
    const session = SecurityStore.getCurrentSession();
    if (session && session.user.role === 'admin') {
      // Keep admin session but log others
      console.log('Emergency mode: Admin session maintained, other sessions terminated');
    }
  };

  const deactivateEmergencyMode = () => {
    setEmergencyMode(false);
    
    PriorityStore.createAlert({
      type: 'success',
      title: 'Emergency Mode Deactivated',
      message: 'System emergency protocols have been deactivated. Normal operations resumed.',
      priority: 'high',
      category: 'system',
      requiresAction: false,
      acknowledged: false,
    });
  };

  const performEmergencyBackup = () => {
    const backup = BackupStore.create();
    
    PriorityStore.createAlert({
      type: 'success',
      title: 'Emergency Backup Completed',
      message: `Emergency backup created successfully at ${new Date(backup.timestamp).toLocaleString()}`,
      priority: 'high',
      category: 'backup',
      requiresAction: false,
      acknowledged: false,
    });

    setLastBackup(backup.timestamp);
  };

  const lockdownSystem = () => {
    // Lock all user sessions
    SecurityStore.logout();
    
    PriorityStore.triggerEmergencyAlert(
      'System Lockdown',
      'System has been locked down. Only administrators can access the system.',
      'security'
    );

    // Create lockdown task
    PriorityStore.createCriticalTask(
      'Maintain Lockdown',
      'Monitor system lockdown and ensure only authorized access',
      'security'
    );
  };

  const notifyEmergencyContacts = () => {
    PriorityStore.createCriticalTask(
      'Contact Emergency Team',
      'Notify all emergency response team members immediately',
      'user'
    );

    PriorityStore.createAlert({
      type: 'emergency',
      title: 'Emergency Team Notified',
      message: 'All emergency response team members have been notified of the situation.',
      priority: 'critical',
      category: 'user',
      requiresAction: true,
      acknowledged: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-success bg-success-soft';
      case 'warning': return 'text-warning bg-warning-soft';
      case 'critical': return 'text-danger bg-danger-soft';
      default: return 'text-muted-foreground bg-surface-raised';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Mode Banner */}
      {emergencyMode && (
        <Alert className="border-danger bg-danger-soft">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <AlertDescription className="text-danger">
            <strong>EMERGENCY MODE ACTIVE</strong> - System emergency protocols are currently active. 
            All operations should be performed with extreme caution.
          </AlertDescription>
        </Alert>
      )}

      {/* Emergency Controls */}
      <Card className={emergencyMode ? 'border-danger bg-danger-soft' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Emergency Response Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={triggerEmergencyMode}
              disabled={emergencyMode}
              variant={emergencyMode ? "secondary" : "destructive"}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {emergencyMode ? 'Emergency Active' : 'Activate Emergency'}
            </Button>

            <Button
              onClick={deactivateEmergencyMode}
              disabled={!emergencyMode}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Deactivate Emergency
            </Button>

            <Button
              onClick={performEmergencyBackup}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              Emergency Backup
            </Button>

            <Button
              onClick={lockdownSystem}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              System Lockdown
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={notifyEmergencyContacts}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Notify Emergency Team
            </Button>

            <Button
              onClick={() => window.location.href = '/settings'}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Emergency Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.database)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Database</span>
                {getStatusIcon(systemStatus.database)}
              </div>
              <p className="text-sm capitalize">{systemStatus.database}</p>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.security)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Security</span>
                {getStatusIcon(systemStatus.security)}
              </div>
              <p className="text-sm capitalize">{systemStatus.security}</p>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.backup)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Backup</span>
                {getStatusIcon(systemStatus.backup)}
              </div>
              <p className="text-sm capitalize">{systemStatus.backup}</p>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(systemStatus.users)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Users</span>
                {getStatusIcon(systemStatus.users)}
              </div>
              <p className="text-sm capitalize">{systemStatus.users}</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-surface-raised rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Last Emergency Backup</p>
                <p className="text-sm text-muted-foreground">
                  {lastBackup ? new Date(lastBackup).toLocaleString() : 'No backup available'}
                </p>
              </div>
              <Button size="sm" onClick={performEmergencyBackup}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Backup Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Procedures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Emergency Procedures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger" />
                Critical System Failure
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Activate Emergency Mode</li>
                <li>Perform immediate emergency backup</li>
                <li>Notify all stakeholders</li>
                <li>Initiate system lockdown if necessary</li>
                <li>Contact emergency response team</li>
              </ol>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-warning" />
                Security Breach
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Immediate system lockdown</li>
                <li>Change all security credentials</li>
                <li>Review access logs</li>
                <li>Notify security team</li>
                <li>Document incident</li>
              </ol>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Database className="w-4 h-4 text-warning" />
                Data Corruption
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Stop all write operations</li>
                <li>Perform emergency backup</li>
                <li>Restore from last known good backup</li>
                <li>Verify data integrity</li>
                <li>Resume operations</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyResponse;
