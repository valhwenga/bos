import React, { useEffect, useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import {
  projectsCache,
  projectTasksCache,
  projectTimeCache,
  projectBugsCache,
  projectEventsCache,
  projectTypesCache,
} from "@/lib/projectStore";
import { toast } from "@/components/ui/use-toast";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, type Project, type Milestone, type ProjectFile } from "@/lib/projectStore";
import { CustomersStore } from "@/lib/customersStore";
import { AuthStore } from "@/lib/authStore";
import { useAccounts } from "@/lib/useAccounts";
import { getCurrentRole, canAccess } from "@/lib/accessControl";
import { notify } from "@/lib/notificationsStore";
import { UserStore } from "@/lib/userStore";

const Details: React.FC = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(projectsCache);
  useCache(projectTasksCache);
  useCache(projectTimeCache);
  useCache(projectBugsCache);
  useCache(projectEventsCache);
  useCache(projectTypesCache);
  const { id } = useParams();
  const navigate = useNavigate();
  // The role's real project access, not the old localStorage `auth.role` key,
  // which defaulted to "admin" and was never written — so this was always true.
  const canEdit = canAccess("projects", "edit");
  const accounts = useAccounts();
  const role = getCurrentRole();
  const acc = AuthStore.currentUser();
  const me = acc?.id || UserStore.get().id;
  const myClientId = acc?.clientId;
  const isAdmin = role.id === "role_super_admin" || role.id === "role_company_admin";

  const initial = useMemo(() => ProjectStore.listProjects().find(p=> p.id === id) as Project | undefined, [id]);
  const [project, setProject] = useState<Project | undefined>(initial);
  const [msTitle, setMsTitle] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!myClientId) return;
    if (!project) return;
    if (project.clientId !== myClientId) navigate(-1);
  }, [myClientId, project, navigate]);

  useEffect(() => {
    if (!project?.dueAt || !project?.assignedToUserId) return;
    const due = new Date(project.dueAt).getTime();
    const now = Date.now();
    const msLeft = due - now;
    if (msLeft <= 0) return;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;
    const checks: { key: string; threshold: number; label: string }[] = [
      { key: "1w", threshold: oneWeek, label: "1 week" },
      { key: "1d", threshold: oneDay, label: "1 day" },
      { key: "1h", threshold: oneHour, label: "1 hour" },
    ];
    for (const c of checks) {
      const rid = `${project.id}:${c.key}`;
      if (msLeft <= c.threshold && !ProjectStore.reminderAlreadySent(rid)) {
        void notify(project.assignedToUserId, "ticket", `Reminder: ${project.name} due in ${c.label}`, `Due: ${new Date(project.dueAt).toLocaleString()}`, `/projects/${project.id}`);
        ProjectStore.markReminderSent(rid);
      }
    }
  }, [project?.id, project?.name, project?.dueAt, project?.assignedToUserId]);

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

  const save = () => { if (!canEdit) return; void ProjectStore.upsertProject(project); };
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
  const addProjectComment = () => { if (!canEdit || !comment.trim()) return; void ProjectStore.addProjectComment(project.id, { id: `c_${Date.now()}`, message: comment, createdAt: new Date().toISOString() }); setComment(""); setProject(ProjectStore.listProjects().find(p=> p.id===project.id)); };

  const types = ProjectStore.listTypes();
  const type = types.find(t => t.key === project.typeKey);
  const allowedAccounts = accounts.filter(a => {
    if (!type) return true;
    if (type.allowedUserIds && type.allowedUserIds.length > 0) return type.allowedUserIds.includes(a.id);
    if (type.allowedRoleIds && type.allowedRoleIds.length > 0) return type.allowedRoleIds.includes(a.roleId);
    return true;
  });

  const assignedAccount = project.assignedToUserId ? accounts.find(a => a.id === project.assignedToUserId) : undefined;

  const setAssignee = (uid: string) => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    const nextStatus = project.status === "pending_approval" || project.status === "closed" ? project.status : "in_progress";
    const next = {
      ...project,
      assignedToUserId: uid || undefined,
      assignedAt: uid ? (project.assignedAt || now) : undefined,
      status: uid ? nextStatus : project.status,
    };
    setProject(next);
    void ProjectStore.upsertProject(next);
  };

  const submitForApproval = () => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    const next: Project = { ...project, status: "pending_approval", submittedAt: now };
    setProject(next);
    void ProjectStore.upsertProject(next);
    if (project.assignedToUserId) {
      void notify(project.assignedToUserId, "ticket", `Project submitted for approval: ${project.name}`, undefined, `/projects/${project.id}`);
    }
  };

  const approveAndClose = () => {
    if (!isAdmin) return;
    const now = new Date().toISOString();
    const next: Project = {
      ...project,
      status: "closed",
      approvedAt: now,
      closedAt: now,
      approvedByUserId: me,
      rejectionReason: undefined,
    };
    setProject(next);
    void ProjectStore.upsertProject(next);
    if (project.assignedToUserId) {
      void notify(project.assignedToUserId, "ticket", `Project approved & closed: ${project.name}`, undefined, `/projects/${project.id}`);
    }
  };

  const rejectClose = () => {
    if (!isAdmin) return;
    const reason = window.prompt("Reason for rejection?") || "";
    if (!reason.trim()) return;
    const now = new Date().toISOString();
    const next: Project = { ...project, status: "rejected", rejectionReason: reason.trim(), approvedAt: now, approvedByUserId: me };
    setProject(next);
    void ProjectStore.upsertProject(next);
    if (project.assignedToUserId) {
      void notify(project.assignedToUserId, "ticket", `Project completion rejected: ${project.name}`, reason.trim(), `/projects/${project.id}`);
    }
  };

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
            <label className="text-xs text-muted-foreground">Project Type</label>
            <select disabled={!canEdit} className="h-10 rounded-md border bg-background px-3" value={project.typeKey || ""} onChange={(e)=> setProject({ ...project, typeKey: e.target.value || undefined, assignedToUserId: undefined })}>
              <option value="">Select type</option>
              {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
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
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Due Date & Time (time limit)</label>
            <Input disabled={!canEdit} type="datetime-local" value={project.dueAt ? new Date(project.dueAt).toISOString().slice(0,16) : ""} onChange={(e)=> setProject({ ...project, dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </div>
          <div className="grid gap-1 md:col-span-3">
            <label className="text-xs text-muted-foreground">Assignment</label>
            <div className="grid md:grid-cols-3 gap-2 items-end">
              <div className="grid gap-1 md:col-span-2">
                <select disabled={!canEdit} className="h-10 rounded-md border bg-background px-3" value={project.assignedToUserId || ""} onChange={(e)=> setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {allowedAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                </select>
                <div className="text-xs text-muted-foreground">
                  {assignedAccount ? `Assigned to: ${assignedAccount.name}` : "Not assigned"}
                  {project.assignedAt ? ` • Assigned at ${new Date(project.assignedAt).toLocaleString()}` : ""}
                  {type ? ` • Type: ${type.label}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={!canEdit} onClick={()=> setAssignee(me)}>Assign to me</Button>
                <Button disabled={!canEdit || !project.assignedToUserId || project.status === "pending_approval" || project.status === "closed"} onClick={submitForApproval}>Submit for Approval</Button>
              </div>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="flex items-center justify-between rounded-md border p-3 bg-secondary/20">
              <div className="text-sm">
                <div className="font-medium">Status: {(project.status || "open").replace(/_/g, " ")}</div>
                {project.submittedAt && <div className="text-xs text-muted-foreground">Submitted: {new Date(project.submittedAt).toLocaleString()}</div>}
                {project.rejectionReason && <div className="text-xs text-destructive">Rejected: {project.rejectionReason}</div>}
                {project.closedAt && <div className="text-xs text-muted-foreground">Closed: {new Date(project.closedAt).toLocaleString()}</div>}
              </div>
              <div className="flex gap-2">
                {isAdmin && project.status === "pending_approval" && (
                  <>
                    <Button variant="secondary" onClick={rejectClose}>Reject</Button>
                    <Button onClick={approveAndClose}>Approve & Close</Button>
                  </>
                )}
              </div>
            </div>
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
