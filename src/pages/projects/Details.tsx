import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, type Project, type Milestone, type ProjectFile } from "@/lib/projectStore";
import { CustomersStore } from "@/lib/customersStore";
import { Permissions } from "@/lib/permissions";

const Details: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const canEdit = Permissions.canEditProjects();

  const initial = useMemo(() => ProjectStore.listProjects().find(p=> p.id === id) as Project | undefined, [id]);
  const [project, setProject] = useState<Project | undefined>(initial);
  const [msTitle, setMsTitle] = useState("");
  const [comment, setComment] = useState("");

  if (!project) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm">Project not found.</div>
            <Button className="mt-3" onClick={()=> navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const save = () => { if (!canEdit) return; ProjectStore.upsertProject(project); };
  const addMilestone = () => { if (!canEdit || !msTitle.trim()) return; const m: Milestone = { id: `m_${Date.now()}`, title: msTitle, status: "pending" }; setMsTitle(""); setProject({ ...project, milestones: [...(project.milestones||[]), m] }); };
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const f = e.target.files; if (!f) return;
    const arr = Array.from(f);
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const pf: ProjectFile = { id: `f_${Date.now()}_${file.name}`, name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) };
        setProject(prev => prev ? { ...prev, files: [...(prev.files||[]), pf] } : prev);
      };
      reader.readAsDataURL(file);
    });
  };
  const addProjectComment = () => { if (!canEdit || !comment.trim()) return; ProjectStore.addProjectComment(project.id, { id: `c_${Date.now()}`, message: comment, createdAt: new Date().toISOString() }); setComment(""); setProject(ProjectStore.listProjects().find(p=> p.id===project.id)); };

  const customers = CustomersStore.list();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project Details</h1>
        {canEdit && <Button onClick={save}>Save Changes</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="grid gap-1 md:col-span-3">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input disabled={!canEdit} value={project.name} onChange={(e)=> setProject({ ...project, name: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Customer</label>
            <select disabled={!canEdit} className="h-10 rounded-md border bg-background px-3" value={project.customerId || ""} onChange={(e)=> setProject({ ...project, customerId: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Start Date</label>
            <Input disabled={!canEdit} type="date" value={project.startDate || ""} onChange={(e)=> setProject({ ...project, startDate: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input disabled={!canEdit} type="date" value={project.endDate || ""} onChange={(e)=> setProject({ ...project, endDate: e.target.value })} />
          </div>
          <div className="grid gap-1 md:col-span-3">
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea disabled={!canEdit} className="min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm" value={project.description || ""} onChange={(e)=> setProject({ ...project, description: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {canEdit && (
              <div className="flex gap-2 mb-3">
                <Input placeholder="Milestone title" value={msTitle} onChange={(e)=> setMsTitle(e.target.value)} />
                <Button variant="secondary" onClick={addMilestone}>Add</Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(project.milestones || []).length===0 && <div className="text-sm text-muted-foreground">No milestones yet.</div>}
              {(project.milestones || []).map(m=> (
                <span key={m.id} className="px-3 py-1 rounded-full bg-secondary text-xs">{m.title}</span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            {canEdit && <input type="file" multiple onChange={onFiles} />}
            <div className="space-y-2 mt-3">
              {(project.files || []).length===0 && <div className="text-sm text-muted-foreground">No files.</div>}
              {(project.files || []).map(f => (
                <a key={f.id} href={f.dataUrl || "#"} target="_blank" className="block text-sm underline break-words">{f.name}</a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Comments</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <div className="grid md:grid-cols-5 gap-2 mb-3">
              <textarea className="md:col-span-4 min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm" placeholder="Add a comment" value={comment} onChange={(e)=> setComment(e.target.value)} />
              <Button onClick={addProjectComment}>Post</Button>
            </div>
          )}
          <div className="space-y-2">
            {(project.comments || []).length===0 && <div className="text-sm text-muted-foreground">No comments yet.</div>}
            {(project.comments || []).sort((a,b)=> (b.createdAt > a.createdAt ? 1 : -1)).map(c => (
              <div key={c.id} className="border rounded-lg p-2 bg-background">
                <div className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</div>
                <div className="text-sm">{c.message}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Details;
