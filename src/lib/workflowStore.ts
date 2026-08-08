export interface WorkflowStep {
  id: string;
  name: string;
  type: 'approval' | 'notification' | 'task' | 'condition' | 'delay' | 'signature';
  assigneeId?: string;
  assigneeRole?: string;
  assigneeDepartment?: string;
  requiredApprovals?: number;
  conditions?: Record<string, any>;
  actions?: string[];
  deadline?: string;
  autoAssign?: boolean;
  parallel?: boolean;
  optional?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: 'invoice' | 'expense' | 'document' | 'procurement' | 'hr' | 'custom';
  triggerType: 'manual' | 'automatic' | 'scheduled';
  triggerConditions?: Record<string, any>;
  steps: WorkflowStep[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  version: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  category: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  currentStep: number;
  initiatorId: string;
  initiatorName: string;
  subject: string;
  description: string;
  data: Record<string, any>;
  attachments?: string[];
  currentAssignees: string[];
  completedSteps: WorkflowStepExecution[];
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface WorkflowStepExecution {
  stepId: string;
  stepName: string;
  assigneeId?: string;
  assigneeName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'completed';
  decision?: string;
  comments?: string;
  completedAt?: string;
  attachments?: string[];
  signatureData?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowInstanceId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  requesterId: string;
  requesterName: string;
  assigneeId: string;
  assigneeName: string;
  subject: string;
  description: string;
  category: string;
  data: Record<string, any>;
  attachments?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  decision?: string;
  comments?: string;
  delegatedTo?: string;
  delegatedToName?: string;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

const WORKFLOWS_KEY = 'workflows';
const INSTANCES_KEY = 'workflow_instances';
const APPROVALS_KEY = 'approval_requests';

export const WorkflowStore = {
  // Workflow Management
  getWorkflows(): Workflow[] {
    try {
      const workflows = localStorage.getItem(WORKFLOWS_KEY);
      return workflows ? JSON.parse(workflows) : [];
    } catch {
      return [];
    }
  },

  createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'version'>): Workflow {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `workflow_${Date.now()}`,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    const workflows = this.getWorkflows();
    workflows.push(newWorkflow);
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));

    // Trigger event
    window.dispatchEvent(new CustomEvent('workflow-created', { detail: newWorkflow }));

    return newWorkflow;
  },

  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const workflows = this.getWorkflows();
    const index = workflows.findIndex(w => w.id === id);
    
    if (index === -1) return null;

    workflows[index] = { 
      ...workflows[index], 
      ...updates,
      version: workflows[index].version + 1
    };
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));

    // Trigger event
    window.dispatchEvent(new CustomEvent('workflow-updated', { detail: workflows[index] }));

    return workflows[index];
  },

  deleteWorkflow(id: string): boolean {
    const workflows = this.getWorkflows();
    const filtered = workflows.filter(w => w.id !== id);
    
    if (filtered.length === workflows.length) return false;

    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(filtered));

    // Trigger event
    window.dispatchEvent(new CustomEvent('workflow-deleted', { detail: { id } }));

    return true;
  },

  // Workflow Instance Management
  getInstances(): WorkflowInstance[] {
    try {
      const instances = localStorage.getItem(INSTANCES_KEY);
      return instances ? JSON.parse(instances) : [];
    } catch {
      return [];
    }
  },

  createInstance(instance: Omit<WorkflowInstance, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentStep'>): WorkflowInstance {
    const newInstance: WorkflowInstance = {
      ...instance,
      id: `instance_${Date.now()}`,
      status: 'pending',
      currentStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSteps: [],
    };

    const instances = this.getInstances();
    instances.push(newInstance);
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(instances));

    // Trigger event
    window.dispatchEvent(new CustomEvent('workflow-instance-created', { detail: newInstance }));

    return newInstance;
  },

  updateInstance(id: string, updates: Partial<WorkflowInstance>): WorkflowInstance | null {
    const instances = this.getInstances();
    const index = instances.findIndex(i => i.id === id);
    
    if (index === -1) return null;

    instances[index] = { 
      ...instances[index], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(instances));

    // Trigger event
    window.dispatchEvent(new CustomEvent('workflow-instance-updated', { detail: instances[index] }));

    return instances[index];
  },

  // Approval Request Management
  getApprovalRequests(): ApprovalRequest[] {
    try {
      const approvals = localStorage.getItem(APPROVALS_KEY);
      return approvals ? JSON.parse(approvals) : [];
    } catch {
      return [];
    }
  },

  createApprovalRequest(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>): ApprovalRequest {
    const newRequest: ApprovalRequest = {
      ...request,
      id: `approval_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const approvals = this.getApprovalRequests();
    approvals.push(newRequest);
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));

    // Trigger event
    window.dispatchEvent(new CustomEvent('approval-request-created', { detail: newRequest }));

    return newRequest;
  },

  updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): ApprovalRequest | null {
    const approvals = this.getApprovalRequests();
    const index = approvals.findIndex(a => a.id === id);
    
    if (index === -1) return null;

    approvals[index] = { 
      ...approvals[index], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));

    // Trigger event
    window.dispatchEvent(new CustomEvent('approval-request-updated', { detail: approvals[index] }));

    return approvals[index];
  },

  // Workflow Execution
  executeWorkflow(workflowId: string, data: Record<string, any>, initiatorId: string, initiatorName: string): WorkflowInstance | null {
    const workflow = this.getWorkflows().find(w => w.id === workflowId);
    if (!workflow) return null;

    const instance = this.createInstance({
      workflowId: workflow.id,
      workflowName: workflow.name,
      category: workflow.category,
      initiatorId,
      initiatorName,
      subject: data.subject || 'Workflow Request',
      description: data.description || '',
      data,
      currentAssignees: [],
      priority: data.priority || 'medium',
      deadline: data.deadline,
    });

    // Start first step
    this.startNextStep(instance.id);

    return instance;
  },

  startNextStep(instanceId: string): boolean {
    const instance = this.getInstances().find(i => i.id === instanceId);
    if (!instance) return false;

    const workflow = this.getWorkflows().find(w => w.id === instance.workflowId);
    if (!workflow) return false;

    if (instance.currentStep >= workflow.steps.length) {
      // Workflow completed
      this.updateInstance(instanceId, { status: 'completed' });
      return true;
    }

    const currentStep = workflow.steps[instance.currentStep];
    
    // Handle different step types
    switch (currentStep.type) {
      case 'approval':
        return this.createApprovalStep(instance, currentStep);
      case 'notification':
        return this.createNotificationStep(instance, currentStep);
      case 'task':
        return this.createTaskStep(instance, currentStep);
      case 'condition':
        return this.evaluateConditionStep(instance, currentStep);
      case 'delay':
        return this.createDelayStep(instance, currentStep);
      case 'signature':
        return this.createSignatureStep(instance, currentStep);
      default:
        return this.moveNextStep(instanceId);
    }
  },

  createApprovalStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Determine assignees
    const assignees = this.determineAssignees(step);
    
    if (assignees.length === 0) {
      // No assignees, skip step
      return this.moveNextStep(instance.id);
    }

    // Create approval requests
    assignees.forEach(assignee => {
      this.createApprovalRequest({
        workflowInstanceId: instance.id,
        workflowId: instance.workflowId,
        stepId: step.id,
        stepName: step.name,
        requesterId: instance.initiatorId,
        requesterName: instance.initiatorName,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        subject: instance.subject,
        description: instance.description,
        category: instance.category,
        data: instance.data,
        attachments: instance.attachments,
        deadline: step.deadline || instance.deadline,
        priority: instance.priority,
      });
    });

    // Update instance
    this.updateInstance(instance.id, {
      status: 'in_progress',
      currentAssignees: assignees.map(a => a.id),
    });

    return true;
  },

  createNotificationStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Send notification (simplified - would integrate with notification system)
    console.log(`Notification for ${instance.subject}: ${step.name}`);
    
    // Auto-complete notification step
    const execution: WorkflowStepExecution = {
      stepId: step.id,
      stepName: step.name,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    this.updateInstance(instance.id, {
      completedSteps: [...instance.completedSteps, execution]
    });

    return this.moveNextStep(instance.id);
  },

  createTaskStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Create task (simplified - would integrate with task system)
    console.log(`Task created for ${instance.subject}: ${step.name}`);
    
    // Auto-complete for demo
    const execution: WorkflowStepExecution = {
      stepId: step.id,
      stepName: step.name,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    this.updateInstance(instance.id, {
      completedSteps: [...instance.completedSteps, execution]
    });

    return this.moveNextStep(instance.id);
  },

  evaluateConditionStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Evaluate conditions (simplified)
    const conditionMet = true; // Would evaluate actual conditions
    
    const execution: WorkflowStepExecution = {
      stepId: step.id,
      stepName: step.name,
      status: conditionMet ? 'completed' : 'skipped',
      completedAt: new Date().toISOString(),
    };

    this.updateInstance(instance.id, {
      completedSteps: [...instance.completedSteps, execution]
    });

    return this.moveNextStep(instance.id);
  },

  createDelayStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Handle delay (simplified - would use setTimeout)
    const delayMs = step.conditions?.delayMs || 60000; // Default 1 minute
    
    setTimeout(() => {
      const execution: WorkflowStepExecution = {
        stepId: step.id,
        stepName: step.name,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      this.updateInstance(instance.id, {
        completedSteps: [...instance.completedSteps, execution]
      });

      this.moveNextStep(instance.id);
    }, delayMs);

    return true;
  },

  createSignatureStep(instance: WorkflowInstance, step: WorkflowStep): boolean {
    // Create signature request (simplified)
    const assignees = this.determineAssignees(step);
    
    assignees.forEach(assignee => {
      this.createApprovalRequest({
        workflowInstanceId: instance.id,
        workflowId: instance.workflowId,
        stepId: step.id,
        stepName: step.name,
        requesterId: instance.initiatorId,
        requesterName: instance.initiatorName,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        subject: `Signature Required: ${instance.subject}`,
        description: instance.description,
        data: instance.data,
        attachments: instance.attachments,
        deadline: step.deadline || instance.deadline,
        priority: instance.priority,
      });
    });

    return true;
  },

  determineAssignees(step: WorkflowStep): Array<{id: string, name: string}> {
    // Simplified assignee determination
    const assignees: Array<{id: string, name: string}> = [];
    
    if (step.assigneeId) {
      // Specific user
      assignees.push({ id: step.assigneeId, name: `User ${step.assigneeId}` });
    } else if (step.assigneeRole) {
      // All users with role
      // Would integrate with user store
      assignees.push({ id: 'role_user', name: `Role: ${step.assigneeRole}` });
    } else if (step.assigneeDepartment) {
      // All users in department
      // Would integrate with user store
      assignees.push({ id: 'dept_user', name: `Dept: ${step.assigneeDepartment}` });
    }

    return assignees;
  },

  moveNextStep(instanceId: string): boolean {
    const instance = this.getInstances().find(i => i.id === instanceId);
    if (!instance) return false;

    const workflow = this.getWorkflows().find(w => w.id === instance.workflowId);
    if (!workflow) return false;

    const nextStep = instance.currentStep + 1;
    
    if (nextStep >= workflow.steps.length) {
      // Workflow completed
      this.updateInstance(instanceId, { 
        status: 'completed',
        currentStep: nextStep
      });
      return true;
    }

    this.updateInstance(instanceId, { 
      currentStep: nextStep,
      currentAssignees: []
    });

    return this.startNextStep(instanceId);
  },

  // Approval Actions
  approveRequest(requestId: string, decision: string, comments?: string): boolean {
    const request = this.getApprovalRequests().find(r => r.id === requestId);
    if (!request) return false;

    this.updateApprovalRequest(requestId, {
      status: 'approved',
      decision,
      comments,
    });

    // Check if all approvals for this step are complete
    this.checkStepCompletion(request.workflowInstanceId, request.stepId);

    return true;
  },

  rejectRequest(requestId: string, decision: string, comments?: string): boolean {
    const request = this.getApprovalRequests().find(r => r.id === requestId);
    if (!request) return false;

    this.updateApprovalRequest(requestId, {
      status: 'rejected',
      decision,
      comments,
    });

    // Reject workflow instance
    this.updateInstance(request.workflowInstanceId, {
      status: 'rejected'
    });

    return true;
  },

  delegateRequest(requestId: string, delegatedTo: string, delegatedToName: string, comments?: string): boolean {
    const request = this.getApprovalRequests().find(r => r.id === requestId);
    if (!request) return false;

    this.updateApprovalRequest(requestId, {
      status: 'delegated',
      delegatedTo,
      delegatedToName,
      comments,
    });

    // Create new request for delegated person
    this.createApprovalRequest({
      workflowInstanceId: request.workflowInstanceId,
      workflowId: request.workflowId,
      stepId: request.stepId,
      stepName: request.stepName,
      requesterId: request.requesterId,
      requesterName: request.requesterName,
      assigneeId: delegatedTo,
      assigneeName: delegatedToName,
      subject: request.subject,
      description: request.description,
      data: request.data,
      attachments: request.attachments,
      deadline: request.deadline,
      priority: request.priority,
    });

    return true;
  },

  checkStepCompletion(instanceId: string, stepId: string): boolean {
    const instance = this.getInstances().find(i => i.id === instanceId);
    if (!instance) return false;

    const workflow = this.getWorkflows().find(w => w.id === instance.workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return false;

    const approvals = this.getApprovalRequests().filter(r => 
      r.workflowInstanceId === instanceId && 
      r.stepId === stepId
    );

    const requiredApprovals = step.requiredApprovals || 1;
    const approvedCount = approvals.filter(a => a.status === 'approved').length;

    if (approvedCount >= requiredApprovals) {
      // Step completed, move to next
      return this.moveNextStep(instanceId);
    }

    return false;
  },

  // Analytics
  getWorkflowAnalytics(): {
    totalWorkflows: number;
    activeWorkflows: number;
    totalInstances: number;
    pendingInstances: number;
    completedInstances: number;
    pendingApprovals: number;
    averageApprovalTime: number;
    workflowsByCategory: Record<string, number>;
  } {
    const workflows = this.getWorkflows();
    const instances = this.getInstances();
    const approvals = this.getApprovalRequests();

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter(w => w.isActive).length,
      totalInstances: instances.length,
      pendingInstances: instances.filter(i => i.status === 'pending' || i.status === 'in_progress').length,
      completedInstances: instances.filter(i => i.status === 'completed').length,
      pendingApprovals: approvals.filter(a => a.status === 'pending').length,
      averageApprovalTime: 24, // Simplified - would calculate actual average
      workflowsByCategory: workflows.reduce((acc, w) => {
        acc[w.category] = (acc[w.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },

  // Initialize default workflows
  initializeDefaultWorkflows(): void {
    const existing = this.getWorkflows();
    if (existing.length > 0) return;

    // Invoice Approval Workflow
    const invoiceWorkflow = this.createWorkflow({
      name: 'Invoice Approval',
      description: 'Multi-level invoice approval process',
      category: 'invoice',
      triggerType: 'automatic',
      triggerConditions: { invoiceAmount: { gt: 5000 } },
      steps: [
        {
          id: 'step_1',
          name: 'Manager Review',
          type: 'approval',
          assigneeRole: 'manager',
          requiredApprovals: 1,
          deadline: '2 days',
        },
        {
          id: 'step_2',
          name: 'Finance Approval',
          type: 'approval',
          assigneeRole: 'admin',
          requiredApprovals: 1,
          deadline: '3 days',
          conditions: { invoiceAmount: { gt: 10000 } },
          optional: true,
        },
      ],
      isActive: true,
      createdBy: 'system',
    });

    // Expense Reimbursement Workflow
    const expenseWorkflow = this.createWorkflow({
      name: 'Expense Reimbursement',
      description: 'Employee expense approval and reimbursement',
      category: 'expense',
      triggerType: 'manual',
      steps: [
        {
          id: 'step_1',
          name: 'Manager Approval',
          type: 'approval',
          assigneeRole: 'manager',
          requiredApprovals: 1,
          deadline: '3 days',
        },
        {
          id: 'step_2',
          name: 'Finance Processing',
          type: 'task',
          assigneeRole: 'admin',
          deadline: '5 days',
        },
      ],
      isActive: true,
      createdBy: 'system',
    });
  },
};
