import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DocumentDashboard from '@/components/DocumentDashboard';
import { DocumentStore } from '@/lib/documentStore';
import { FileText, Upload, Folder, Search, Share2, Archive, Settings } from 'lucide-react';

const DocumentsPage: React.FC = () => {
  const handleCreateFolder = () => {
    const newFolder = DocumentStore.createDocument({
      name: `New Folder ${Date.now()}`,
      description: 'Folder created for document organization',
      type: 'folder',
      path: '/documents',
      category: 'other' as const,
      tags: ['folder'],
      status: 'approved' as const,
      createdBy: 'current_user',
      createdByName: 'Current User',
      isPublic: false,
      isLocked: false,
      metadata: {},
      permissions: [],
    });
    console.log('Created folder:', newFolder);
  };

  const handleCreateDocument = () => {
    const newDoc = DocumentStore.createDocument({
      name: `Document ${Date.now()}.pdf`,
      description: 'Sample document created for demonstration',
      type: 'file',
      path: '/documents',
      category: 'other' as const,
      tags: ['sample', 'demo'],
      status: 'draft' as const,
      createdBy: 'current_user',
      createdByName: 'Current User',
      isPublic: false,
      isLocked: false,
      size: 1024 * 1024, // 1MB
      mimeType: 'application/pdf',
      metadata: {},
      permissions: [],
    });
    console.log('Created document:', newDoc);
  };

  const handleSearchDocuments = () => {
    const results = DocumentStore.searchDocuments('document');
    console.log('Search results:', results);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Document Management</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>»</span>
            <span className="text-primary">Documents</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleCreateFolder}>
            <Folder className="w-4 h-4 mr-2" />
            Create Folder
          </Button>
          <Button onClick={handleCreateDocument}>
            <FileText className="w-4 h-4 mr-2" />
            Create Document
          </Button>
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
          <Button variant="outline" onClick={handleSearchDocuments}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Document Management Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Document Library</p>
                <p className="font-semibold">Centralized Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">File Upload</p>
                <p className="font-semibold">Drag & Drop</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Collaboration</p>
                <p className="font-semibold">Share & Comment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Version Control</p>
                <p className="font-semibold">Track Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Document Dashboard */}
      <DocumentDashboard />
    </div>
  );
};

export default DocumentsPage;
