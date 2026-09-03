import { useMemo, useState } from "react";
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
import { ProjectCard, type ProjectCardStatus } from "@/components/ProjectCard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Search, FolderKanban, Play, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProjectStore, type ProjectFile, type Milestone } from "@/lib/projectStore";
import { CustomersStore } from "@/lib/customersStore";
import { AuthStore } from "@/lib/authStore";
import { ClientsStore } from "@/lib/clientsStore";
import { Link } from "react-router-dom";

const Projects = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(projectsCache);
  useCache(projectTasksCache);
  useCache(projectTimeCache);
  useCache(projectBugsCache);
  useCache(projectEventsCache);
  useCache(projectTypesCache);
  const acc = AuthStore.currentUser();
  const myClientId = acc?.clientId;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [clientId, setClientId] = useState("");
  const [typeKey, setTypeKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [msTitle, setMsTitle] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [list, setList] = useState(ProjectStore.listProjects().filter(p => (myClientId ? p.clientId === myClientId : true)));
  const add = () => {
    if (!name.trim()) return;
    const id = `p_${Date.now()}`;
    const nextClientId = myClientId || (clientId || undefined);
    void ProjectStore.upsertProject({
      id,
      name,
      clientId: nextClientId,
      customerId: customerId || undefined,
      typeKey: typeKey || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      description,
      milestones,
      files,
    });
    setName("");
    setCustomerId("");
    setClientId("");
    setTypeKey("");
    setStartDate("");
    setEndDate("");
    setDueAt("");
    setDescription("");
    setMilestones([]);
    setFiles([]);
    setOpen(false);
    setList(ProjectStore.listProjects().filter(p => (myClientId ? p.clientId === myClientId : true)));
  };
  const addMilestone = () => {
    if (!msTitle.trim()) return;
    setMilestones((m)=> [...m, { id: `m_${Date.now()}`, title: msTitle, status: "pending" }]);
    setMsTitle("");
  };
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files; if (!f) return;
    const arr = Array.from(f);
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles(prev => [...prev, { id: `f_${Date.now()}_${file.name}`, name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const STATUS_LABEL: Record<string, ProjectCardStatus> = {
    open: "Open",
    in_progress: "In Progress",
    pending_approval: "Pending",
    rejected: "Rejected",
    closed: "Complete",
  };

  const isOverdue = (p: { status?: string; dueAt?: string }) =>
    p.status !== "closed" && !!p.dueAt && new Date(p.dueAt).getTime() < Date.now();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((p) => {
      if (statusFilter !== "all" && (p.status || "open") !== statusFilter) return false;
      if (!needle) return true;
      return `${p.name} ${p.description ?? ""}`.toLowerCase().includes(needle);
    });
  }, [list, query, statusFilter]);

  const activeCount = list.filter((p) => p.status === "open" || p.status === "in_progress").length;
  const overdueCount = list.filter(isOverdue).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Projects"
        description="Work in flight, who it's for and when it's due."
        breadcrumbs={[{ label: "Projects", to: "/projects" }, { label: "All projects" }]}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add project
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Projects" value={list.length} hint="All time" icon={FolderKanban} />
          <StatCard label="Active" value={activeCount} hint="Open or in progress" icon={Play} tone="info" />
          <StatCard
            label="Overdue"
            value={overdueCount}
            hint={overdueCount ? "Past their due date" : "Nothing overdue"}
            icon={AlertCircle}
            tone={overdueCount ? "danger" : "neutral"}
          />
        </div>
      </PageHeader>

      {/* These controls previously did nothing: the Filter menu items had no
          handlers and the Status button had no action at all. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="h-9 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-card">
          <EmptyState
            icon={FolderKanban}
            variant={list.length ? "search" : "empty"}
            title={list.length ? "No projects match" : "No projects yet"}
            description={
              list.length
                ? "Try a different search term or clear the status filter."
                : "Create a project to track its tasks, milestones and time."
            }
            action={list.length ? undefined : <Button onClick={() => setOpen(true)}>Add project</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block h-full rounded-md focus-visible:outline-none">
              <ProjectCard
                icon={project.name[0] || "P"}
                title={project.name}
                description={project.description || ""}
                status={STATUS_LABEL[project.status || "open"] ?? "Open"}
                members={[]}
                startDate={project.startDate || ""}
                dueDate={project.dueAt ? new Date(project.dueAt).toLocaleDateString() : (project.endDate || "")}
                overdue={isOverdue(project)}
              />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Project Name</label>
              <Input value={name} onChange={(e)=> setName(e.target.value)} />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {!myClientId && (
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Client</label>
                  <select className="h-10 rounded-md border bg-background px-3" value={clientId} onChange={(e)=> setClientId(e.target.value)}>
                    <option value="">Select client</option>
                    {ClientsStore.list().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Project Type</label>
                <select className="h-10 rounded-md border bg-background px-3" value={typeKey} onChange={(e)=> setTypeKey(e.target.value)}>
                  <option value="">Select type</option>
                  {ProjectStore.listTypes().map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Customer</label>
                <select className="h-10 rounded-md border bg-background px-3" value={customerId} onChange={(e)=> setCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {CustomersStore.list().map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e)=> setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e)=> setEndDate(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Due Date & Time (time limit)</label>
                <Input type="datetime-local" value={dueAt} onChange={(e)=> setDueAt(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea className="min-h-[90px] rounded-md border bg-background px-3 py-2 text-sm" value={description} onChange={(e)=> setDescription(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Milestones</label>
              <div className="flex gap-2">
                <Input placeholder="Milestone title" value={msTitle} onChange={(e)=> setMsTitle(e.target.value)} />
                <Button variant="secondary" onClick={addMilestone}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {milestones.map(m => (
                  <span key={m.id} className="text-xs px-2 py-1 rounded-full bg-secondary">{m.title}</span>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Files</label>
              <input type="file" multiple onChange={onFiles} />
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map(f=> (
                  <span key={f.id} className="text-xs px-2 py-1 rounded-full bg-secondary">{f.name}</span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
