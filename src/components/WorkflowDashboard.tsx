import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowStore, WorkflowInstance, ApprovalRequest } from '@/lib/workflowStore';
import { SecurityStore } from '@/lib/securityStore';
import {
  Workflow as WorkflowIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  CreditCard,
  Settings,
  Play,
  Pause,
  Edit,
  Trash2,
  Eye,
  Send,
  Calendar,
  TrendingUp,
  BarChart3
} from 'lucide-react';

const WorkflowDashboard: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [analytics, setAnalytics] = useState(WorkflowStore.getWorkflowAnalytics());
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Load data
    setWorkflows(WorkflowStore.getWorkflows());
    setInstances(WorkflowStore.getInstances());
    setApprovals(WorkflowStore.getApprovalRequests());
    setAnalytics(WorkflowStore.getWorkflowAnalytics());
    setCurrentUser(SecurityStore.getCurrentSession()?.user);

    // Initialize default workflows
    WorkflowStore.initializeDefaultWorkflows();

    // Set up event listeners
    const handleWorkflowChange = () => {
      setWorkflows(WorkflowStore.getWorkflows());
      setAnalytics(WorkflowStore.getWorkflowAnalytics());
    };

    const handleInstanceChange = () => {
      setInstances(WorkflowStore.getInstances());
      setAnalytics(WorkflowStore.getWorkflowAnalytics());
    };

    const handleApprovalChange = () => {
      setApprovals(WorkflowStore.getApprovalRequests());
      setAnalytics(WorkflowStore.getWorkflowAnalytics());
    };

    window.addEventListener('workflow-created', handleWorkflowChange as EventListener);
    window.addEventListener('workflow-updated', handleWorkflowChange as EventListener);
    window.addEventListener('workflow-instance-created', handleInstanceChange as EventListener);
    window.addEventListener('workflow-instance-updated', handleInstanceChange as EventListener);
    window.addEventListener('approval-request-created', handleApprovalChange as EventListener);
    window.addEventListener('approval-request-updated', handleApprovalChange as EventListener);

    return () => {
      window.removeEventListener('workflow-created', handleWorkflowChange as EventListener);
      window.removeEventListener('workflow-updated', handleWorkflowChange as EventListener);
      window.removeEventListener('workflow-instance-created', handleInstanceChange as EventListener);
      window.removeEventListener('workflow-instance-updated', handleInstanceChange as EventListener);
      window.removeEventListener('approval-request-created', handleApprovalChange as EventListener);
      window.removeEventListener('approval-request-updated', handleApprovalChange as EventListener);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'approved': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-info text-info-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      case 'rejected': return 'bg-danger text-danger-foreground';
      case 'cancelled': return 'bg-gray-500 text-primary-foreground';
      default: return 'bg-gray-500 text-primary-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-danger text-danger-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-info text-info-foreground';
      case 'low': return 'bg-gray-500 text-primary-foreground';
      default: return 'bg-gray-500 text-primary-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'invoice': return <FileText className="w-4 h-4" />;
      case 'expense': return <CreditCard className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      case 'hr': return <Users className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getWorkflowCategory = (request: ApprovalRequest) => {
    // Get category from workflow instance
    const instance = instances.find(i => i.id === request.workflowInstanceId);
    return instance?.category || 'custom';
  };

  const handleApprove = (requestId: string) => {
    WorkflowStore.approveRequest(requestId, 'Approved', 'Approved via dashboard');
  };

  const handleReject = (requestId: string) => {
    WorkflowStore.rejectRequest(requestId, 'Rejected', 'Rejected via dashboard');
  };

  const handleStartWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    WorkflowStore.executeWorkflow(workflowId, {
      subject: `Test ${workflow.name}`,
      description: 'Test workflow execution',
      priority: 'medium'
    }, currentUser?.id || 'system', currentUser?.name || 'System');
  };

  const myApprovals = approvals.filter(a => a.assigneeId === currentUser?.id && a.status === 'pending');
  const myInstances = instances.filter(i => i.initiatorId === currentUser?.id);

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
                <p className="text-2xl font-bold">{analytics.totalWorkflows}</p>
                <p className="text-xs text-success">{analytics.activeWorkflows} active</p>
              </div>
              <WorkflowIcon className="w-8 h-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold">{myApprovals.length}</p>
                <p className="text-xs text-warning">{analytics.pendingApprovals} total</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Requests</p>
                <p className="text-2xl font-bold">{myInstances.length}</p>
                <p className="text-xs text-info">{analytics.pendingInstances} pending</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{analytics.completedInstances}</p>
                <p className="text-xs text-success">{analytics.averageApprovalTime}h avg</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="approvals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="approvals">My Approvals</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* My Approvals Tab */}
        <TabsContent value="approvals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myApprovals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending approvals</p>
                ) : (
                  myApprovals.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(getWorkflowCategory(request))}
                          <span className="font-medium">{request.subject}</span>
                          <Badge className={getPriorityColor(request.priority)}>
                            {request.priority}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p><strong>From:</strong> {request.requesterName}</p>
                          <p><strong>Step:</strong> {request.stepName}</p>
                          {request.deadline && (
                            <p><strong>Deadline:</strong> {new Date(request.deadline).toLocaleDateString()}</p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(request.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(request.id)}>
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                My Workflow Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myInstances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No workflow requests</p>
                ) : (
                  myInstances.map((instance) => (
                    <div key={instance.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(instance.category)}
                          <span className="font-medium">{instance.subject}</span>
                          <Badge className={getStatusColor(instance.status)}>
                            {instance.status}
                          </Badge>
                          <Badge className={getPriorityColor(instance.priority)}>
                            {instance.priority}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(instance.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{instance.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p><strong>Workflow:</strong> {instance.workflowName}</p>
                          <p><strong>Current Step:</strong> {instance.currentStep + 1} of {workflows.find(w => w.id === instance.workflowId)?.steps.length || 0}</p>
                          {instance.currentAssignees.length > 0 && (
                            <p><strong>With:</strong> {instance.currentAssignees.length} assignees</p>
                          )}
                        </div>
                        
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <WorkflowIcon className="w-5 h-5" />
                Workflow Templates
              </CardTitle>
              <Button>
                <Edit className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(workflow.category)}
                        <span className="font-medium">{workflow.name}</span>
                        <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">{workflow.category}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleStartWorkflow(workflow.id)}>
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span><strong>Steps:</strong> {workflow.steps.length}</span>
                      <span><strong>Trigger:</strong> {workflow.triggerType}</span>
                      <span><strong>Version:</strong> {workflow.version}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Workflows by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.workflowsByCategory).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <span className="capitalize">{category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-info h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (count / analytics.totalWorkflows) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Instances</span>
                    <span className="font-bold">{analytics.totalInstances}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed</span>
                    <span className="font-bold text-success">{analytics.completedInstances}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending</span>
                    <span className="font-bold text-warning">{analytics.pendingInstances}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Approval Time</span>
                    <span className="font-bold">{analytics.averageApprovalTime}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Approvals</span>
                    <span className="font-bold text-warning">{analytics.pendingApprovals}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowDashboard;
