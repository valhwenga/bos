export interface Document {
  id: string;
  name: string;
  description?: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  path: string;
  parentId?: string;
  category: 'contract' | 'invoice' | 'report' | 'template' | 'presentation' | 'spreadsheet' | 'image' | 'video' | 'other';
  tags: string[];
  version: number;
  currentVersion: number;
  status: 'draft' | 'review' | 'approved' | 'archived' | 'deleted';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  modifiedBy?: string;
  modifiedByName?: string;
  expiresAt?: string;
  isPublic: boolean;
  isLocked: boolean;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  downloadCount: number;
  viewCount: number;
  metadata: Record<string, any>;
  permissions: DocumentPermission[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  name: string;
  description?: string;
  size: number;
  mimeType?: string;
  content?: string; // Base64 encoded content
  url?: string;
  checksum: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  changeLog: string;
  isCurrent: boolean;
  tags: string[];
}

export interface DocumentPermission {
  id: string;
  documentId: string;
  userId?: string;
  roleId?: string;
  departmentId?: string;
  permission: 'read' | 'write' | 'delete' | 'share' | 'admin';
  grantedBy: string;
  grantedByName: string;
  grantedAt: string;
  expiresAt?: string;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  version?: number;
  userId: string;
  userName: string;
  content: string;
  type: 'comment' | 'suggestion' | 'approval' | 'rejection';
  position?: {
    page?: number;
    x?: number;
    y?: number;
  };
  resolved: boolean;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  replies: DocumentComment[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'document' | 'form' | 'contract' | 'report';
  content: string; // Template content with placeholders
  variables: TemplateVariable[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  usageCount: number;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface DocumentActivity {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'downloaded' | 'shared' | 'locked' | 'unlocked' | 'commented';
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const DOCUMENTS_KEY = 'documents';
const VERSIONS_KEY = 'document_versions';
const PERMISSIONS_KEY = 'document_permissions';
const COMMENTS_KEY = 'document_comments';
const TEMPLATES_KEY = 'document_templates';
const ACTIVITY_KEY = 'document_activity';

export const DocumentStore = {
  // Document Management
  getDocuments(): Document[] {
    try {
      const documents = localStorage.getItem(DOCUMENTS_KEY);
      return documents ? JSON.parse(documents) : [];
    } catch {
      return [];
    }
  },

  createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'currentVersion' | 'downloadCount' | 'viewCount'>): Document {
    const newDocument: Document = {
      ...document,
      id: `doc_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      currentVersion: 1,
      downloadCount: 0,
      viewCount: 0,
      metadata: {},
      permissions: [],
    };

    const documents = this.getDocuments();
    documents.push(newDocument);
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));

    // Log activity
    this.logActivity(newDocument.id, document.createdBy, document.createdByName, 'created', `Document "${document.name}" created`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-created', { detail: newDocument }));

    return newDocument;
  },

  updateDocument(id: string, updates: Partial<Document>): Document | null {
    const documents = this.getDocuments();
    const index = documents.findIndex(d => d.id === id);
    
    if (index === -1) return null;

    const oldDocument = documents[index];
    documents[index] = { 
      ...documents[index], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));

    // Log activity
    this.logActivity(id, updates.modifiedBy || 'system', updates.modifiedByName || 'System', 'updated', `Document "${documents[index].name}" updated`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-updated', { detail: documents[index] }));

    return documents[index];
  },

  deleteDocument(id: string, userId: string, userName: string): boolean {
    const documents = this.getDocuments();
    const document = documents.find(d => d.id === id);
    
    if (!document) return false;

    // Soft delete
    const success = this.updateDocument(id, { 
      status: 'deleted',
      modifiedBy: userId,
      modifiedByName: userName
    });

    if (success) {
      this.logActivity(id, userId, userName, 'deleted', `Document "${document.name}" deleted`);
      window.dispatchEvent(new CustomEvent('document-deleted', { detail: { id } }));
    }

    return !!success;
  },

  // Version Management
  getVersions(documentId: string): DocumentVersion[] {
    try {
      const versions = localStorage.getItem(VERSIONS_KEY);
      const allVersions = versions ? JSON.parse(versions) : [];
      return allVersions.filter((v: DocumentVersion) => v.documentId === documentId);
    } catch {
      return [];
    }
  },

  createVersion(version: Omit<DocumentVersion, 'id' | 'createdAt' | 'isCurrent'>): DocumentVersion {
    const newVersion: DocumentVersion = {
      ...version,
      id: `ver_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isCurrent: true,
    };

    // Mark other versions as not current
    const versions = this.getVersions(version.documentId);
    versions.forEach(v => v.isCurrent = false);

    const allVersions = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
    allVersions.push(newVersion);
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(allVersions));

    // Update document version
    this.updateDocument(version.documentId, {
      version: version.version,
      currentVersion: version.version,
      modifiedBy: version.createdBy,
      modifiedByName: version.createdByName,
    });

    // Log activity
    this.logActivity(version.documentId, version.createdBy, version.createdByName, 'updated', `Version ${version.version} created for document`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-version-created', { detail: newVersion }));

    return newVersion;
  },

  // Permission Management
  getPermissions(documentId: string): DocumentPermission[] {
    try {
      const permissions = localStorage.getItem(PERMISSIONS_KEY);
      const allPermissions = permissions ? JSON.parse(permissions) : [];
      return allPermissions.filter((p: DocumentPermission) => p.documentId === documentId);
    } catch {
      return [];
    }
  },

  grantPermission(permission: Omit<DocumentPermission, 'id' | 'grantedAt'>): DocumentPermission {
    const newPermission: DocumentPermission = {
      ...permission,
      id: `perm_${Date.now()}`,
      grantedAt: new Date().toISOString(),
    };

    const permissions = JSON.parse(localStorage.getItem(PERMISSIONS_KEY) || '[]');
    permissions.push(newPermission);
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

    // Log activity
    this.logActivity(permission.documentId, permission.grantedBy, permission.grantedByName, 'shared', `Permission granted to ${permission.userId || permission.roleId || permission.departmentId}`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-permission-granted', { detail: newPermission }));

    return newPermission;
  },

  revokePermission(permissionId: string): boolean {
    const permissions = JSON.parse(localStorage.getItem(PERMISSIONS_KEY) || '[]');
    const permission = permissions.find((p: DocumentPermission) => p.id === permissionId);
    
    if (!permission) return false;

    const filtered = permissions.filter((p: DocumentPermission) => p.id !== permissionId);
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(filtered));

    // Log activity
    this.logActivity(permission.documentId, 'system', 'System', 'shared', `Permission revoked from ${permission.userId || permission.roleId || permission.departmentId}`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-permission-revoked', { detail: { permissionId } }));

    return true;
  },

  // Comment Management
  getComments(documentId: string): DocumentComment[] {
    try {
      const comments = localStorage.getItem(COMMENTS_KEY);
      const allComments = comments ? JSON.parse(comments) : [];
      return allComments.filter((c: DocumentComment) => c.documentId === documentId);
    } catch {
      return [];
    }
  },

  addComment(comment: Omit<DocumentComment, 'id' | 'createdAt' | 'updatedAt' | 'replies'>): DocumentComment {
    const newComment: DocumentComment = {
      ...comment,
      id: `comment_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };

    const comments = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
    comments.push(newComment);
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));

    // Log activity
    this.logActivity(comment.documentId, comment.userId, comment.userName, 'commented', `Comment added to document`);

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-comment-added', { detail: newComment }));

    return newComment;
  },

  // Template Management
  getTemplates(): DocumentTemplate[] {
    try {
      const templates = localStorage.getItem(TEMPLATES_KEY);
      return templates ? JSON.parse(templates) : [];
    } catch {
      return [];
    }
  },

  createTemplate(template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): DocumentTemplate {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    const templates = this.getTemplates();
    templates.push(newTemplate);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-template-created', { detail: newTemplate }));

    return newTemplate;
  },

  // Activity Logging
  getActivities(documentId?: string): DocumentActivity[] {
    try {
      const activities = localStorage.getItem(ACTIVITY_KEY);
      const allActivities = activities ? JSON.parse(activities) : [];
      
      if (documentId) {
        return allActivities.filter((a: DocumentActivity) => a.documentId === documentId);
      }
      
      return allActivities;
    } catch {
      return [];
    }
  },

  logActivity(documentId: string, userId: string, userName: string, action: DocumentActivity['action'], details: string): void {
    const activity: DocumentActivity = {
      id: `activity_${Date.now()}`,
      documentId,
      userId,
      userName,
      action,
      details,
      createdAt: new Date().toISOString(),
    };

    const activities = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
    activities.push(activity);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));

    // Trigger event
    window.dispatchEvent(new CustomEvent('document-activity-logged', { detail: activity }));
  },

  // Document Operations
  incrementViewCount(documentId: string, userId: string, userName: string): void {
    const document = this.getDocuments().find(d => d.id === documentId);
    if (document) {
      this.updateDocument(documentId, { viewCount: document.viewCount + 1 });
      this.logActivity(documentId, userId, userName, 'viewed', `Document "${document.name}" viewed`);
    }
  },

  incrementDownloadCount(documentId: string, userId: string, userName: string): void {
    const document = this.getDocuments().find(d => d.id === documentId);
    if (document) {
      this.updateDocument(documentId, { downloadCount: document.downloadCount + 1 });
      this.logActivity(documentId, userId, userName, 'downloaded', `Document "${document.name}" downloaded`);
    }
  },

  lockDocument(documentId: string, userId: string, userName: string): boolean {
    const document = this.getDocuments().find(d => d.id === documentId);
    if (document && !document.isLocked) {
      this.updateDocument(documentId, {
        isLocked: true,
        lockedBy: userId,
        lockedByName: userName,
        lockedAt: new Date().toISOString(),
      });
      this.logActivity(documentId, userId, userName, 'locked', `Document "${document.name}" locked`);
      return true;
    }
    return false;
  },

  unlockDocument(documentId: string, userId: string, userName: string): boolean {
    const document = this.getDocuments().find(d => d.id === documentId);
    if (document && document.isLocked && (document.lockedBy === userId || userName === 'Admin')) {
      this.updateDocument(documentId, {
        isLocked: false,
        lockedBy: undefined,
        lockedByName: undefined,
        lockedAt: undefined,
      });
      this.logActivity(documentId, userId, userName, 'unlocked', `Document "${document.name}" unlocked`);
      return true;
    }
    return false;
  },

  // Search and Filtering
  searchDocuments(query: string, filters?: {
    category?: string;
    tags?: string[];
    status?: string;
    createdBy?: string;
    dateRange?: { start: string; end: string };
  }): Document[] {
    const documents = this.getDocuments().filter(d => d.status !== 'deleted');
    
    return documents.filter(doc => {
      // Text search
      const matchesQuery = !query || 
        doc.name.toLowerCase().includes(query.toLowerCase()) ||
        doc.description?.toLowerCase().includes(query.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

      // Category filter
      const matchesCategory = !filters?.category || doc.category === filters.category;

      // Tags filter
      const matchesTags = !filters?.tags || filters.tags.length === 0 ||
        filters.tags.some(tag => doc.tags.includes(tag));

      // Status filter
      const matchesStatus = !filters?.status || doc.status === filters.status;

      // Created by filter
      const matchesCreatedBy = !filters?.createdBy || doc.createdBy === filters.createdBy;

      // Date range filter
      const matchesDateRange = !filters?.dateRange || (
        new Date(doc.createdAt) >= new Date(filters.dateRange.start) &&
        new Date(doc.createdAt) <= new Date(filters.dateRange.end)
      );

      return matchesQuery && matchesCategory && matchesTags && matchesStatus && matchesCreatedBy && matchesDateRange;
    });
  },

  // Analytics
  getDocumentAnalytics(): {
    totalDocuments: number;
    documentsByCategory: Record<string, number>;
    documentsByStatus: Record<string, number>;
    totalStorage: number;
    mostViewed: Document[];
    mostDownloaded: Document[];
    recentActivity: DocumentActivity[];
    templatesCount: number;
  } {
    const documents = this.getDocuments().filter(d => d.status !== 'deleted');
    const activities = this.getActivities();
    const templates = this.getTemplates();

    return {
      totalDocuments: documents.length,
      documentsByCategory: documents.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      documentsByStatus: documents.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalStorage: documents.reduce((acc, doc) => acc + (doc.size || 0), 0),
      mostViewed: documents.sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
      mostDownloaded: documents.sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 5),
      recentActivity: activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
      templatesCount: templates.length,
    };
  },

  // Initialize default templates
  initializeDefaultTemplates(): void {
    const existing = this.getTemplates();
    if (existing.length > 0) return;

    // Contract Template
    this.createTemplate({
      name: 'Service Agreement',
      description: 'Standard service contract template',
      category: 'contract',
      type: 'contract',
      content: `
# Service Agreement

**Client Name:** {{clientName}}
**Service Provider:** {{providerName}}
**Date:** {{date}}

## Services
{{services}}

## Payment Terms
- Total Amount: {{amount}}
- Payment Due: {{dueDate}}

## Terms and Conditions
{{terms}}

**Client Signature:** _________________________
**Date:** _________________________

**Provider Signature:** _________________________
**Date:** _________________________
      `.trim(),
      variables: [
        { name: 'clientName', type: 'text', label: 'Client Name', required: true },
        { name: 'providerName', type: 'text', label: 'Provider Name', required: true },
        { name: 'date', type: 'date', label: 'Agreement Date', required: true },
        { name: 'services', type: 'text', label: 'Services Description', required: true },
        { name: 'amount', type: 'number', label: 'Total Amount', required: true },
        { name: 'dueDate', type: 'date', label: 'Payment Due Date', required: true },
        { name: 'terms', type: 'text', label: 'Terms and Conditions', required: false },
      ],
      createdBy: 'system',
      createdByName: 'System',
      isPublic: true,
    });

    // Invoice Template
    this.createTemplate({
      name: 'Invoice Template',
      description: 'Standard invoice template',
      category: 'invoice',
      type: 'document',
      content: `
# Invoice

**Invoice Number:** {{invoiceNumber}}
**Date:** {{date}}
**Due Date:** {{dueDate}}

**Bill To:**
{{clientName}}
{{clientAddress}}

**From:**
{{companyName}}
{{companyAddress}}

## Items
{{items}}

**Total Amount:** {{totalAmount}}

**Payment Terms:**
{{paymentTerms}}
      `.trim(),
      variables: [
        { name: 'invoiceNumber', type: 'text', label: 'Invoice Number', required: true },
        { name: 'date', type: 'date', label: 'Invoice Date', required: true },
        { name: 'dueDate', type: 'date', label: 'Due Date', required: true },
        { name: 'clientName', type: 'text', label: 'Client Name', required: true },
        { name: 'clientAddress', type: 'text', label: 'Client Address', required: true },
        { name: 'companyName', type: 'text', label: 'Company Name', required: true },
        { name: 'companyAddress', type: 'text', label: 'Company Address', required: true },
        { name: 'items', type: 'text', label: 'Invoice Items', required: true },
        { name: 'totalAmount', type: 'number', label: 'Total Amount', required: true },
        { name: 'paymentTerms', type: 'text', label: 'Payment Terms', required: false },
      ],
      createdBy: 'system',
      createdByName: 'System',
      isPublic: true,
    });
  },
};
