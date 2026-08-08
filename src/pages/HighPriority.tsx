import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HighPriorityDashboard from '@/components/HighPriorityDashboard';
import EmergencyResponse from '@/components/EmergencyResponse';
import { PriorityStore } from '@/lib/priorityStore';
import { AlertTriangle, Shield, Zap, Settings, Bell } from 'lucide-react';

const HighPriorityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const summary = PriorityStore.getPrioritySummary();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">High Priority Center</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>»</span>
            <span className="text-primary">High Priority</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {summary.criticalTasks > 0 && (
            <Badge variant="destructive" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {summary.criticalTasks} Critical
            </Badge>
          )}
          
          {summary.unacknowledgedAlerts > 0 && (
            <Badge variant="secondary" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {summary.unacknowledgedAlerts} Alerts
            </Badge>
          )}
          
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Priority Dashboard
          </TabsTrigger>
          <TabsTrigger value="emergency" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Emergency Response
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Priority Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <HighPriorityDashboard />
        </TabsContent>

        <TabsContent value="emergency">
          <EmergencyResponse />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Priority System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Alert Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Critical Alert Threshold
                        </label>
                        <select className="w-full border rounded px-3 py-2">
                          <option>Immediate</option>
                          <option>5 minutes</option>
                          <option>15 minutes</option>
                          <option>30 minutes</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Alert Escalation
                        </label>
                        <select className="w-full border rounded px-3 py-2">
                          <option>Auto-escalate to admin</option>
                          <option>Manual escalation only</option>
                          <option>No escalation</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Notification Methods
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked />
                            <span className="text-sm">In-app notifications</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" />
                            <span className="text-sm">Email alerts</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" />
                            <span className="text-sm">SMS alerts</span>
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Task Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Auto-assignment Rules
                        </label>
                        <select className="w-full border rounded px-3 py-2">
                          <option>Assign by department</option>
                          <option>Assign by role</option>
                          <option>Round-robin assignment</option>
                          <option>No auto-assignment</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Task Priority Escalation
                        </label>
                        <select className="w-full border rounded px-3 py-2">
                          <option>Escalate after 1 hour</option>
                          <option>Escalate after 4 hours</option>
                          <option>Escalate after 8 hours</option>
                          <option>Escalate after 24 hours</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Default Task Duration
                        </label>
                        <select className="w-full border rounded px-3 py-2">
                          <option>30 minutes</option>
                          <option>1 hour</option>
                          <option>2 hours</option>
                          <option>4 hours</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Emergency Procedures</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Emergency Contact Email
                        </label>
                        <input
                          type="email"
                          className="w-full border rounded px-3 py-2"
                          placeholder="emergency@company.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          className="w-full border rounded px-3 py-2"
                          placeholder="+1-555-0123"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Auto-backup Frequency (Emergency Mode)
                      </label>
                      <select className="w-full border rounded px-3 py-2">
                        <option>Every 5 minutes</option>
                        <option>Every 15 minutes</option>
                        <option>Every 30 minutes</option>
                        <option>Every hour</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        System Lockdown Triggers
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked />
                          <span className="text-sm">Multiple failed login attempts</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked />
                          <span className="text-sm">Security breach detected</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" />
                          <span className="text-sm">Manual admin trigger</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" />
                          <span className="text-sm">System health critical</span>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                  <Button variant="outline">Reset to Defaults</Button>
                  <Button>Save Settings</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HighPriorityPage;
