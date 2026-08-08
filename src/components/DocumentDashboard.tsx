import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentStore, Document, DocumentVersion, DocumentComment, DocumentTemplate } from '@/lib/documentStore';
import { SecurityStore } from '@/lib/securityStore';
import {
  FileText,
  Folder,
  Search,
  Upload,
  Download,
  Eye,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Share2,
  Clock,
  TrendingUp,
  BarChart3,
  Users,
  Calendar,
  Filter,
  Plus,
  File,
  Image,
  Video,
  FileSpreadsheet,
  Presentation,
  Tag,
  Activity,
  History,
  MessageSquare,
  Star,
  Archive,
  FolderOpen,
  ChevronRight,
  Home,
  X,
  Check,
  Copy,
  Move
} from 'lucide-react';

const DocumentDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [analytics, setAnalytics] = useState(DocumentStore.getDocumentAnalytics());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('documents');
  
  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<Document | null>(null);
  const [folderPath, setFolderPath] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  
  // Dialog states
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateDocumentDialog, setShowCreateDocumentDialog] = useState(false);
  const [itemToRename, setItemToRename] = useState<Document | null>(null);
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentType, setNewDocumentType] = useState('other');
  const [newDocumentCategory, setNewDocumentCategory] = useState('other');
  const [newDocumentDescription, setNewDocumentDescription] = useState('');
  const [newDocumentTags, setNewDocumentTags] = useState('');
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Document type definitions
  const documentTypes = [
    { value: 'pdf', label: 'PDF Document', icon: FileText, mimeType: 'application/pdf' },
    { value: 'doc', label: 'Word Document', icon: FileText, mimeType: 'application/msword' },
    { value: 'docx', label: 'Word Document', icon: FileText, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { value: 'xls', label: 'Excel Spreadsheet', icon: FileSpreadsheet, mimeType: 'application/vnd.ms-excel' },
    { value: 'xlsx', label: 'Excel Spreadsheet', icon: FileSpreadsheet, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { value: 'ppt', label: 'PowerPoint', icon: Presentation, mimeType: 'application/vnd.ms-powerpoint' },
    { value: 'pptx', label: 'PowerPoint', icon: Presentation, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { value: 'txt', label: 'Text File', icon: FileText, mimeType: 'text/plain' },
    { value: 'jpg', label: 'JPEG Image', icon: Image, mimeType: 'image/jpeg' },
    { value: 'jpeg', label: 'JPEG Image', icon: Image, mimeType: 'image/jpeg' },
    { value: 'png', label: 'PNG Image', icon: Image, mimeType: 'image/png' },
    { value: 'gif', label: 'GIF Image', icon: Image, mimeType: 'image/gif' },
    { value: 'mp4', label: 'MP4 Video', icon: Video, mimeType: 'video/mp4' },
    { value: 'avi', label: 'AVI Video', icon: Video, mimeType: 'video/x-msvideo' },
    { value: 'mp3', label: 'MP3 Audio', icon: FileText, mimeType: 'audio/mpeg' },
    { value: 'zip', label: 'ZIP Archive', icon: Archive, mimeType: 'application/zip' },
    { value: 'other', label: 'Other', icon: File, mimeType: 'application/octet-stream' },
  ];

  // Helper functions
  const getCurrentPathDocuments = () => {
    const parentId = currentFolder?.id;
    return documents.filter(doc => 
      doc.parentId === parentId && 
      doc.status !== 'deleted'
    );
  };

  const navigateToFolder = (folder: Document) => {
    if (folder.type === 'folder') {
      setFolderPath([...folderPath, folder]);
      setCurrentFolder(folder);
      setSelectedDocuments([]);
    }
  };

  const navigateToParent = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1] : null);
      setSelectedDocuments([]);
    }
  };

  const navigateToRoot = () => {
    setFolderPath([]);
    setCurrentFolder(null);
    setSelectedDocuments([]);
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [
      { id: 'root', name: 'Home', icon: Home }
    ];
    
    folderPath.forEach((folder, index) => ({
      id: folder.id,
      name: folder.name,
      icon: Folder
    }));
    
    return breadcrumbs;
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder = DocumentStore.createDocument({
      name: newFolderName,
      description: 'Created folder',
      type: 'folder',
      path: currentFolder ? `${currentFolder.path}/${newFolderName}` : `/documents/${newFolderName}`,
      category: 'other' as const,
      tags: ['folder'],
      status: 'approved' as const,
      createdBy: currentUser?.id || 'system',
      createdByName: currentUser?.name || 'System',
      isPublic: false,
      isLocked: false,
      parentId: currentFolder?.id,
      metadata: {},
      permissions: [],
    });

    setDocuments(DocumentStore.getDocuments());
    setNewFolderName('');
    setShowCreateFolderDialog(false);
    console.log('Folder created:', newFolder);
  };

  const handleRenameItem = () => {
    if (!itemToRename || !newFolderName.trim()) return;

    DocumentStore.updateDocument(itemToRename.id, {
      name: newFolderName,
      modifiedBy: currentUser?.id || 'system',
      modifiedByName: currentUser?.name || 'System',
    });

    setDocuments(DocumentStore.getDocuments());
    setNewFolderName('');
    setShowRenameDialog(false);
    setItemToRename(null);
    console.log('Item renamed:', itemToRename.name, '->', newFolderName);
  };

  const handleCreateDocument = () => {
    if (!newDocumentName.trim()) return;

    const docType = documentTypes.find(t => t.value === newDocumentType);
    const tags = newDocumentTags.split(',').map(tag => tag.trim()).filter(tag => tag);

    const newDocument = DocumentStore.createDocument({
      name: newDocumentName,
      description: newDocumentDescription,
      type: 'file',
      path: currentFolder ? `${currentFolder.path}/${newDocumentName}` : `/documents/${newDocumentName}`,
      category: newDocumentCategory as Document['category'],
      tags: tags,
      status: 'draft' as const,
      createdBy: currentUser?.id || 'system',
      createdByName: currentUser?.name || 'System',
      isPublic: false,
      isLocked: false,
      parentId: currentFolder?.id,
      mimeType: docType?.mimeType,
      size: 0, // Will be updated when file is uploaded
      metadata: {},
      permissions: [],
    });

    setDocuments(DocumentStore.getDocuments());
    setNewDocumentName('');
    setNewDocumentDescription('');
    setNewDocumentTags('');
    setShowCreateDocumentDialog(false);
    console.log('Document created:', newDocument);
  };

  const handleFileUpload = () => {
    uploadedFiles.forEach(file => {
      const docType = documentTypes.find(t => t.mimeType === file.type) || 
                     documentTypes.find(t => file.name.toLowerCase().endsWith(`.${t.value}`)) ||
                     documentTypes.find(t => t.value === 'other');

      const newDocument = DocumentStore.createDocument({
        name: file.name,
        description: `Uploaded file: ${file.name}`,
        type: 'file',
        path: currentFolder ? `${currentFolder.path}/${file.name}` : `/documents/${file.name}`,
        category: newDocumentCategory as Document['category'],
        tags: ['uploaded'],
        status: 'draft' as const,
        createdBy: currentUser?.id || 'system',
        createdByName: currentUser?.name || 'System',
        isPublic: false,
        isLocked: false,
        parentId: currentFolder?.id,
        mimeType: docType?.mimeType,
        size: file.size,
        metadata: {},
        permissions: [],
      });

      console.log('File uploaded:', newDocument);
    });

    setDocuments(DocumentStore.getDocuments());
    setUploadedFiles([]);
    setShowUploadDialog(false);
  };

  const handleDeleteDocument = (documentId: string) => {
    DocumentStore.deleteDocument(documentId, currentUser?.id || 'system', currentUser?.name || 'System');
    setDocuments(DocumentStore.getDocuments());
    setSelectedDocuments(selectedDocuments.filter(id => id !== documentId));
  };

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const openRenameDialog = (document: Document) => {
    setItemToRename(document);
    setNewFolderName(document.name);
    setShowRenameDialog(true);
  };

  useEffect(() => {
    // Load data
    setDocuments(DocumentStore.getDocuments());
    setTemplates(DocumentStore.getTemplates());
    setAnalytics(DocumentStore.getDocumentAnalytics());
    setCurrentUser(SecurityStore.getCurrentSession()?.user);

    // Initialize default templates
    DocumentStore.initializeDefaultTemplates();

    // Set up event listeners
    const handleDocumentChange = () => {
      setDocuments(DocumentStore.getDocuments());
      setAnalytics(DocumentStore.getDocumentAnalytics());
    };

    const handleTemplateChange = () => {
      setTemplates(DocumentStore.getTemplates());
    };

    window.addEventListener('document-created', handleDocumentChange as EventListener);
    window.addEventListener('document-updated', handleDocumentChange as EventListener);
    window.addEventListener('document-deleted', handleDocumentChange as EventListener);
    window.addEventListener('document-template-created', handleTemplateChange as EventListener);

    return () => {
      window.removeEventListener('document-created', handleDocumentChange as EventListener);
      window.removeEventListener('document-updated', handleDocumentChange as EventListener);
      window.removeEventListener('document-deleted', handleDocumentChange as EventListener);
      window.removeEventListener('document-template-created', handleTemplateChange as EventListener);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500 text-white';
      case 'review': return 'bg-yellow-500 text-white';
      case 'approved': return 'bg-green-500 text-white';
      case 'archived': return 'bg-blue-500 text-white';
      case 'deleted': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'contract': return <FileText className="w-4 h-4" />;
      case 'invoice': return <FileText className="w-4 h-4" />;
      case 'report': return <FileText className="w-4 h-4" />;
      case 'template': return <FileText className="w-4 h-4" />;
      case 'presentation': return <Presentation className="w-4 h-4" />;
      case 'spreadsheet': return <FileSpreadsheet className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleViewDocument = (documentId: string) => {
    DocumentStore.incrementViewCount(documentId, currentUser?.id || 'system', currentUser?.name || 'System');
    console.log('Viewing document:', documentId);
  };

  const handleDownloadDocument = (documentId: string) => {
    DocumentStore.incrementDownloadCount(documentId, currentUser?.id || 'system', currentUser?.name || 'System');
    console.log('Downloading document:', documentId);
  };

  const handleLockDocument = (documentId: string) => {
    DocumentStore.lockDocument(documentId, currentUser?.id || 'system', currentUser?.name || 'System');
    setDocuments(DocumentStore.getDocuments());
  };

  const handleUnlockDocument = (documentId: string) => {
    DocumentStore.unlockDocument(documentId, currentUser?.id || 'system', currentUser?.name || 'System');
    setDocuments(DocumentStore.getDocuments());
  };

  const filteredDocuments = DocumentStore.searchDocuments(searchQuery, {
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
  });

  const currentPathDocuments = getCurrentPathDocuments();
  const folders = currentPathDocuments.filter(doc => doc.type === 'folder');
  const files = currentPathDocuments.filter(doc => doc.type === 'file');

  const myDocuments = documents.filter(d => d.createdBy === currentUser?.id);
  const sharedDocuments = documents.filter(d => d.isPublic && d.createdBy !== currentUser?.id);

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{analytics.totalDocuments}</p>
                <p className="text-xs text-blue-600">{analytics.templatesCount} templates</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Documents</p>
                <p className="text-2xl font-bold">{myDocuments.length}</p>
                <p className="text-xs text-green-600">{myDocuments.filter(d => d.status === 'approved').length} approved</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-2xl font-bold">{formatFileSize(analytics.totalStorage)}</p>
                <p className="text-xs text-orange-600">{analytics.mostViewed.length} popular</p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Shared</p>
                <p className="text-2xl font-bold">{sharedDocuments.length}</p>
                <p className="text-xs text-purple-600">{documents.filter(d => d.isLocked).length} locked</p>
              </div>
              <Share2 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Document Library
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => setShowCreateFolderDialog(true)}>
                    <Folder className="w-4 h-4 mr-2" />
                    New Folder
                  </Button>
                  <Button onClick={() => setShowCreateDocumentDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Document
                  </Button>
                  <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files
                  </Button>
                </div>
              </div>
              
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={navigateToRoot}>
                  <Home className="w-4 h-4" />
                </Button>
                {folderPath.map((folder, index) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Button variant="ghost" size="sm" onClick={() => navigateToFolder(folder)}>
                      <Folder className="w-4 h-4 mr-1" />
                      {folder.name}
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="contract">Contracts</SelectItem>
                    <SelectItem value="invoice">Invoices</SelectItem>
                    <SelectItem value="report">Reports</SelectItem>
                    <SelectItem value="template">Templates</SelectItem>
                    <SelectItem value="presentation">Presentations</SelectItem>
                    <SelectItem value="spreadsheet">Spreadsheets</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Folders Section */}
              {folders.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    Folders ({folders.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigateToFolder(folder)}
                      >
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-8 h-8 text-blue-500" />
                          <div className="flex-1">
                            <p className="font-medium">{folder.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {documents.filter(d => d.parentId === folder.id).length} items
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Files ({files.length})
                </h3>
                <div className="space-y-4">
                  {files.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No files in this folder</p>
                  ) : (
                    files.map((document) => (
                      <div key={document.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.includes(document.id)}
                              onChange={() => handleSelectDocument(document.id)}
                              className="rounded"
                            />
                            {getCategoryIcon(document.category)}
                            <span className="font-medium">{document.name}</span>
                            <Badge className={getStatusColor(document.status)}>
                              {document.status}
                            </Badge>
                            {document.isLocked && (
                              <Badge variant="outline">
                                <Lock className="w-3 h-3 mr-1" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(document.updatedAt)}
                          </span>
                        </div>
                        
                        {document.description && (
                          <p className="text-sm text-muted-foreground mb-2">{document.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{formatFileSize(document.size)}</span>
                            <span>v{document.currentVersion}</span>
                            <span>{document.viewCount} views</span>
                            <span>{document.downloadCount} downloads</span>
                            {document.tags.length > 0 && (
                              <div className="flex gap-1">
                                {document.tags.slice(0, 3).map((tag, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {document.tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{document.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDocument(document.id)}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(document.id)}>
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openRenameDialog(document)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Rename
                            </Button>
                            <Button size="sm" variant="outline">
                              <Share2 className="w-4 h-4 mr-1" />
                              Share
                            </Button>
                            {document.isLocked ? (
                              <Button size="sm" variant="outline" onClick={() => handleUnlockDocument(document.id)}>
                                <Unlock className="w-4 h-4 mr-1" />
                                Unlock
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleLockDocument(document.id)}>
                                <Lock className="w-4 h-4 mr-1" />
                                Lock
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleDeleteDocument(document.id)}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Document Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">{template.name}</span>
                        <Badge variant="outline">{template.type}</Badge>
                        {template.isPublic && (
                          <Badge variant="outline">Public</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Used {template.usageCount} times
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{template.variables.length} variables</span>
                        <span>{formatDate(template.updatedAt)}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          Use Template
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 p-3 border rounded">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.details}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.userName} · {formatDate(activity.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activity.action}
                    </Badge>
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
                  Documents by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.documentsByCategory).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <span className="capitalize">{category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (count / analytics.totalDocuments) * 100)}%`
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
                  Most Viewed Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.mostViewed.map((document, index) => (
                    <div key={document.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                        <span className="text-sm">{document.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold">{document.viewCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {itemToRename?.type === 'folder' ? 'Folder' : 'Document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameItem}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Document Dialog */}
      <Dialog open={showCreateDocumentDialog} onOpenChange={setShowCreateDocumentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Name</label>
              <Input
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={newDocumentType} onValueChange={setNewDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={newDocumentCategory} onValueChange={setNewDocumentCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newDocumentDescription}
                onChange={(e) => setNewDocumentDescription(e.target.value)}
                placeholder="Enter description (optional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                value={newDocumentTags}
                onChange={(e) => setNewDocumentTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDocumentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDocument}>Create Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Files Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Files</label>
              <Input
                type="file"
                multiple
                onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category for uploaded files</label>
              <Select value={newDocumentCategory} onValueChange={setNewDocumentCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadedFiles.length > 0 && (
              <div>
                <label className="text-sm font-medium">Files to upload:</label>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={uploadedFiles.length === 0}>
              Upload Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentDashboard;
