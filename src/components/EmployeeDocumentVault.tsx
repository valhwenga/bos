import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, File, Trash2, Eye } from "lucide-react";
import { EmployeeDocumentsStore, type EmployeeDocument } from "@/lib/employeeDocumentsStore";
import { UserStore } from "@/lib/userStore";

type Props = {
  employeeId: string;
};

export function EmployeeDocumentVault({ employeeId }: Props) {
  const [docs, setDocs] = useState(EmployeeDocumentsStore.forEmployee(employeeId));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = UserStore.get();

  const [form, setForm] = useState({
    fileName: "",
    fileType: "",
    category: "other" as EmployeeDocument["category"],
    description: "",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const doc: EmployeeDocument = {
        id: `DOC${Date.now()}`,
        employeeId,
        fileName: file.name,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id || "",
        category: form.category,
        description: form.description,
        size: file.size,
        base64,
      };
      EmployeeDocumentsStore.upsert(doc);
      setDocs(EmployeeDocumentsStore.forEmployee(employeeId));
      setOpen(false);
      setForm({ fileName: "", fileType: "", category: "other", description: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const remove = (id: string) => {
    EmployeeDocumentsStore.remove(id);
    setDocs(EmployeeDocumentsStore.forEmployee(employeeId));
  };

  const view = (doc: EmployeeDocument) => {
    if (doc.base64) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<iframe src="${doc.base64}" style="width:100%;height:100vh;border:none"></iframe>`);
        win.document.close();
      }
    } else if (doc.url) {
      window.open(doc.url, "_blank");
    }
  };

  const categoryColors: Record<EmployeeDocument["category"], string> = {
    contract: "bg-info text-info-foreground",
    id: "bg-success text-success-foreground",
    visa: "bg-primary text-primary-foreground",
    tax: "bg-warning text-warning-foreground",
    other: "bg-gray-500 text-primary-foreground",
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">Document Vault</h4>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
            <div className="flex items-center gap-3">
              <File className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">{doc.fileName}</div>
                <div className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</div>
              </div>
              <Badge className={categoryColors[doc.category]}>{doc.category}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => view(doc)}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => remove(doc.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <div className="text-center text-muted-foreground py-4">No documents uploaded.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as EmployeeDocument["category"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="id">ID</SelectItem>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description (optional)</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes about this document" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">File</label>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="block w-full text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
