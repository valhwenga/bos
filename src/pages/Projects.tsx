import { useState } from "react";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Grid3x3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProjectStore, type ProjectFile, type Milestone } from "@/lib/projectStore";
import { CustomersStore } from "@/lib/customersStore";
import { Link } from "react-router-dom";

const Projects = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [msTitle, setMsTitle] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [list, setList] = useState(ProjectStore.listProjects());
  const add = () => {
    if (!name.trim()) return;
    const id = `p_${Date.now()}`;
    ProjectStore.upsertProject({ id, name, customerId: customerId || undefined, startDate: startDate || undefined, endDate: endDate || undefined, description, milestones, files });
    setName("");
    setCustomerId("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setMilestones([]);
    setFiles([]);
    setOpen(false);
    setList(ProjectStore.listProjects());
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
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Projects</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span className="text-primary">Projects</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>All Projects</DropdownMenuItem>
              <DropdownMenuItem>On Hold</DropdownMenuItem>
              <DropdownMenuItem>In Progress</DropdownMenuItem>
              <DropdownMenuItem>Complete</DropdownMenuItem>
              <DropdownMenuItem>Canceled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm">
            <Grid3x3 className="w-4 h-4 mr-2" />
            Status
          </Button>

          <Button size="sm" onClick={()=> setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {list.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`} className="block">
            <ProjectCard icon={project.name[0] || "P"} iconBg="#10b981" title={project.name} description="" status={"In Progress" as const} members={[]} startDate="" dueDate="" />
          </Link>
        ))}
      </div>

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
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e)=> setEndDate(e.target.value)} />
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
