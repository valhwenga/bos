import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import WorkflowDashboard from '@/components/WorkflowDashboard';
import { WorkflowStore } from '@/lib/workflowStore';
import { Workflow, Play, Settings, FileText, TrendingUp } from 'lucide-react';

const WorkflowPage: React.FC = () => {
  const handleCreateWorkflow = () => {
    // Create a simple test workflow
    const workflow = WorkflowStore.createWorkflow({
      name: 'Test Approval Workflow',
      description: 'A test workflow for demonstration',
      category: 'custom',
      triggerType: 'manual',
      steps: [
        {
          id: 'step_1',
          name: 'Initial Review',
          type: 'approval',
          assigneeRole: 'manager',
          requiredApprovals: 1,
          deadline: '2 days',
        },
        {
          id: 'step_2',
          name: 'Final Approval',
          type: 'approval',
          assigneeRole: 'admin',
          requiredApprovals: 1,
          deadline: '3 days',
        },
      ],
      isActive: true,
      createdBy: 'current_user',
    });

    console.log('Created workflow:', workflow);
  };

  const handleExecuteTestWorkflow = () => {
    const workflows = WorkflowStore.getWorkflows();
    const testWorkflow = workflows.find(w => w.name === 'Test Approval Workflow');
    
    if (testWorkflow) {
      const instance = WorkflowStore.executeWorkflow(
        testWorkflow.id,
        {
          subject: 'Test Workflow Execution',
          description: 'This is a test of the workflow system',
          priority: 'medium'
        },
        'test_user',
        'Test User'
      );
      console.log('Started workflow instance:', instance);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workflow & Approvals</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span className="text-foreground">Workflow</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleCreateWorkflow}>
            <Settings className="w-4 h-4 mr-2" />
            Create Workflow
          </Button>
          <Button variant="outline" onClick={handleExecuteTestWorkflow}>
            <Play className="w-4 h-4 mr-2" />
            Test Workflow
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Workflow Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Workflow Engine</p>
                <p className="font-semibold">Automated Processes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Approval System</p>
                <p className="font-semibold">Multi-level Approvals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Document Routing</p>
                <p className="font-semibold">Smart Workflows</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Analytics</p>
                <p className="font-semibold">Performance Tracking</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Workflow Dashboard */}
      <WorkflowDashboard />
    </div>
  );
};

export default WorkflowPage;
