import { useCallback, useEffect, useRef, useState } from "react";
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
import { toast } from "@/components/ui/use-toast";

type Props = {
  employeeId: string;
};

export function EmployeeDocumentVault({ employeeId }: Props) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [busy, setBusy] = useState(false);
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

  const refresh = useCallback(() => {
    void EmployeeDocumentsStore.forEmployee(employeeId)
      .then(setDocs)
      .catch((err: unknown) =>
        toast({
          title: "Could not load documents",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        }),
      );
  }, [employeeId]);

  useEffect(refresh, [refresh]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      // The file goes to private object storage. Storage enforces the bucket's
      // size and type limits, so an oversized or disallowed file is refused
      // here with a reason, rather than silently failing as it did when these
      // were base64 strings competing for the localStorage quota.
      await EmployeeDocumentsStore.upload({ employeeId, file, category: form.category });
      refresh();
      setOpen(false);
      setForm({ fileName: "", fileType: "", category: "other", description: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document uploaded", description: file.name });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "The document was not saved.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: EmployeeDocument) => {
    if (!window.confirm(`Delete ${doc.fileName}? This cannot be undone.`)) return;
    try {
      await EmployeeDocumentsStore.remove(doc, employeeId);
      refresh();
    } catch (err) {
      toast({
        title: "Could not delete the document",
        description: err instanceof Error ? err.message : "It is unchanged.",
        variant: "destructive",
      });
    }
  };

  const view = async (doc: EmployeeDocument) => {
    try {
      // The bucket is private, so this is a short-lived signed link rather than
      // a stored URL that would keep working if it leaked.
      const url = await EmployeeDocumentsStore.openUrl(doc, employeeId);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast({
        title: "Could not open the document",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const categoryColors: Record<EmployeeDocument["category"], string> = {
    contract: "bg-info text-info-foreground",
    id: "bg-success text-success-foreground",
    visa: "bg-primary text-primary-foreground",
    tax: "bg-warning text-warning-foreground",
    other: "bg-secondary text-secondary-foreground",
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
              <Button size="icon" variant="outline" onClick={() => void view(doc)}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => void remove(doc)}>
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
              <input type="file" disabled={busy} ref={fileInputRef} onChange={(e) => void handleFileSelect(e)} className="block w-full text-sm" />
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
