import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BackupStore, BackupData, BackupSchedule } from '@/lib/backupStore';
import { Download, Upload, Clock, Shield, Database, Trash2, Play, Settings } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule>();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    setBackups(BackupStore.list());
    setSchedule(BackupStore.getSchedule());

    const handleBackupChange = () => {
      setBackups(BackupStore.list());
    };

    window.addEventListener('backup-created', handleBackupChange);
    window.addEventListener('backup-restored', handleBackupChange);

    return () => {
      window.removeEventListener('backup-created', handleBackupChange);
      window.removeEventListener('backup-restored', handleBackupChange);
    };
  }, []);

  const createBackup = () => {
    try {
      const backup = BackupStore.create();
      setBackups(BackupStore.list());
      toast({
        title: "Backup Created",
        description: `Backup created successfully at ${new Date(backup.timestamp).toLocaleString()}`,
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: "Failed to create backup",
        variant: "destructive"
      });
    }
  };

  const restoreBackup = async (backupId: string) => {
    // The wording matters: this restores what the browser holds, not the
    // database. Promising "all current data" would be untrue now.
    if (window.confirm('Restore this backup? It replaces the data this browser holds. Accounting, HR and payroll live in the database and are not affected.')) {
      try {
        await BackupStore.restore(backupId);
        toast({
          title: "Backup Restored",
          description: "System has been restored from backup successfully",
        });
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast({
          title: "Restore Failed",
          description: "Failed to restore backup",
          variant: "destructive"
        });
      }
    }
  };

  const deleteBackup = (backupId: string) => {
    if (window.confirm('Are you sure you want to delete this backup?')) {
      BackupStore.delete(backupId);
      setBackups(BackupStore.list());
      toast({
        title: "Backup Deleted",
        description: "Backup has been deleted",
      });
    }
  };

  const exportBackup = (backupId: string) => {
    try {
      BackupStore.export(backupId);
      toast({
        title: "Export Started",
        description: "Backup file download started",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export backup",
        variant: "destructive"
      });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      const backup = await BackupStore.import(importFile);
      if (window.confirm('Import this backup? It replaces the data this browser holds, not the database.')) {
        await BackupStore.restore(backup.timestamp);
        toast({
          title: "Import Successful",
          description: "Backup has been imported successfully",
        });
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import backup",
        variant: "destructive"
      });
    }
    setShowImportDialog(false);
    setImportFile(null);
  };

  const updateSchedule = (updates: Partial<BackupSchedule>) => {
    const newSchedule = { ...schedule!, ...updates };
    BackupStore.setSchedule(newSchedule);
    setSchedule(newSchedule);
    toast({
      title: "Schedule Updated",
      description: "Backup schedule has been updated",
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Backup Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button onClick={createBackup} className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Create Backup
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)} className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Backup
            </Button>
            <Button variant="outline" onClick={() => updateSchedule({ enabled: !schedule?.enabled })} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              {schedule?.enabled ? 'Disable Auto' : 'Enable Auto'}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Automatic Backup Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Badge variant={schedule?.enabled ? "default" : "secondary"}>
                {schedule?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <Select 
                value={schedule?.frequency} 
                onValueChange={(value: any) => updateSchedule({ frequency: value })}
                disabled={!schedule?.enabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Backup</label>
              <div className="text-sm text-muted-foreground">
                {schedule?.lastBackup ? new Date(schedule.lastBackup).toLocaleString() : 'Never'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Storage Used</label>
              <div className="text-sm text-muted-foreground">
                {BackupStore.getBackupSize()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Backup History ({backups.length})
            </div>
            <Badge variant="outline">{BackupStore.getBackupSize()}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No backups created yet</p>
              <p className="text-sm">Create your first backup to protect your data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div key={backup.timestamp} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">
                      {new Date(backup.timestamp).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Version {backup.version} • 
                      {backup.metadata?.totalItems || 0} items • 
                      {backup.metadata?.totalSize || 'Unknown'} • 
                      {backup.metadata?.storesBackedUp?.length || 0} stores
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Includes: {backup.invoices?.length || 0} invoices,
                      {backup.customers?.length || 0} customers,
                      {backup.crm?.deals?.length || 0} deals,
                      {backup.employees?.length || 0} employees
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportBackup(backup.timestamp)}
                      title="Export backup"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void restoreBackup(backup.timestamp)}
                      title="Restore backup"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteBackup(backup.timestamp)}
                      title="Delete backup"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Backup File</label>
              <Input
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importFile && (
              <div className="p-3 bg-muted rounded">
                <p className="text-sm">
                  <strong>File:</strong> {importFile.name}<br />
                  <strong>Size:</strong> {formatFileSize(importFile.size)}<br />
                  <strong>Type:</strong> {importFile.type}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import Backup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackupManager;
