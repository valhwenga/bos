export type ProjectFile = { id: string; name: string; type: string; size: number; dataUrl?: string };
export type Milestone = { id: string; title: string; dueDate?: string; status?: "pending" | "inprogress" | "completed" };
export type Comment = { id: string; author?: string; message: string; createdAt: string };
export type Project = { id: string; name: string; customerId?: string; startDate?: string; endDate?: string; description?: string; milestones?: Milestone[]; files?: ProjectFile[]; comments?: Comment[] };
export type TaskStatus = "todo" | "inprogress" | "done";
export type TaskUpdate = { id: string; author?: string; message: string; createdAt: string };
export type Task = { id: string; projectId: string; title: string; status: TaskStatus; assignedTo?: string; description?: string; updates?: TaskUpdate[] };
export type TimeEntry = { id: string; projectId: string; taskId?: string; seconds: number; startedAt: string };
export type Bug = { id: string; projectId: string; title: string; severity: "low" | "med" | "high"; open: boolean };
export type CalendarEventType = "task" | "meeting" | "reminder" | "other";
export type CalendarEvent = {
  id: string;
  projectId?: string;
  date: string; // YYYY-MM-DD for DayPicker highlighting
  title: string;
  startAt?: string; // ISO datetime when it happens
  type?: CalendarEventType;
  description?: string;
  remindWeek?: boolean;
  remindDay?: boolean;
  remindHour?: boolean;
};

const K = {
  projects: "proj.projects",
  tasks: "proj.tasks",
  time: "proj.time",
  bugs: "proj.bugs",
  events: "proj.events",
};

const r = <T,>(k: string, f: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; }
};
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

export const ProjectStore = {
  listProjects(): Project[] { return r<Project[]>(K.projects, [{ id: "p_default", name: "Default Project" }]); },
  upsertProject(p: Project) { const all = this.listProjects(); const i = all.findIndex(x=>x.id===p.id); if(i>=0) all[i]=p; else all.push(p); w(K.projects, all); return p; },
  listTasks(): Task[] { return r<Task[]>(K.tasks, []); },
  listTime(): TimeEntry[] { return r<TimeEntry[]>(K.time, []); },
  listBugs(): Bug[] { return r<Bug[]>(K.bugs, []); },
  listEvents(): CalendarEvent[] { return r<CalendarEvent[]>(K.events, []); },

  upsertTask(t: Task) { const all = this.listTasks(); const i = all.findIndex(x=>x.id===t.id); if(i>=0) all[i]=t; else all.push(t); w(K.tasks, all); return t; },
  upsertBug(b: Bug) { const all = this.listBugs(); const i = all.findIndex(x=>x.id===b.id); if(i>=0) all[i]=b; else all.push(b); w(K.bugs, all); return b; },
  addTime(te: TimeEntry) { const all = this.listTime(); all.push(te); w(K.time, all); return te; },
  addEvent(ev: CalendarEvent) { const all = this.listEvents(); all.push(ev); w(K.events, all); emit('proj.events-changed'); return ev; },
  updateEvent(ev: CalendarEvent) { const all = this.listEvents(); const i = all.findIndex(x=> x.id===ev.id); if (i>=0) all[i]=ev; w(K.events, all); emit('proj.events-changed'); return ev; },
  removeEvent(id: string) { const all = this.listEvents().filter(x=> x.id!==id); w(K.events, all); emit('proj.events-changed'); },

  addProjectFile(projectId: string, file: ProjectFile) {
    const projects = this.listProjects();
    const p = projects.find(p=>p.id===projectId); if(!p) return;
    p.files = p.files || [];
    p.files.push(file);
    this.upsertProject(p);
  },
  addMilestone(projectId: string, m: Milestone) {
    const projects = this.listProjects();
    const p = projects.find(p=>p.id===projectId); if(!p) return;
    p.milestones = p.milestones || [];
    p.milestones.push(m);
    this.upsertProject(p);
  },
  addProjectComment(projectId: string, c: Comment) {
    const projects = this.listProjects();
    const p = projects.find(p=>p.id===projectId); if(!p) return;
    p.comments = p.comments || [];
    p.comments.push(c);
    this.upsertProject(p);
  },
  addTaskUpdate(taskId: string, u: TaskUpdate) {
    const tasks = this.listTasks();
    const t = tasks.find(t=>t.id===taskId); if(!t) return;
    t.updates = t.updates || [];
    t.updates.push(u);
    this.upsertTask(t);
  }
};
