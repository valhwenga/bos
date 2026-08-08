export type ProjectFile = { id: string; name: string; type: string; size: number; dataUrl?: string };
export type Milestone = { id: string; title: string; dueDate?: string; status?: "pending" | "inprogress" | "completed" };
export type Comment = { id: string; author?: string; message: string; createdAt: string };
export type ProjectStatus = "open" | "in_progress" | "pending_approval" | "rejected" | "closed";
export type Project = {
  id: string;
  name: string;
  clientId?: string;
  customerId?: string;
  typeKey?: string;
  assignedToUserId?: string;
  supervisorRole?: "admin";
  status?: ProjectStatus;
  dueAt?: string; // ISO datetime
  startDate?: string;
  endDate?: string;
  description?: string;
  milestones?: Milestone[];
  files?: ProjectFile[];
  comments?: Comment[];

  // timestamps for performance tracking
  createdAt?: string;
  assignedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  closedAt?: string;
  approvedByUserId?: string;
  approvalNote?: string;
  rejectionReason?: string;
};

export type ProjectType = {
  key: string;
  label: string;
  allowedRoleIds?: string[];
  allowedUserIds?: string[];
};
export type TaskStatus = "todo" | "inprogress" | "done";
export type TaskUpdate = { id: string; author?: string; message: string; createdAt: string };
export type Task = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assignedTo?: string;
  assignedToUserId?: string;
  dueAt?: string; // ISO
  description?: string;
  updates?: TaskUpdate[];
};
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
  types: "proj.types",
  remindersSent: "proj.reminders.sent",
};

const r = <T,>(k: string, f: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; }
};
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch { void 0; } };

const DEFAULT_TYPES: ProjectType[] = [
  { key: "implementation", label: "Implementation", allowedRoleIds: ["role_project_manager", "role_employee"] },
  { key: "support", label: "Support", allowedRoleIds: ["role_support_agent", "role_employee"] },
  { key: "maintenance", label: "Maintenance", allowedRoleIds: ["role_project_manager", "role_employee"] },
];

const readSet = (k: string): Set<string> => {
  try {
    const v = localStorage.getItem(k);
    if (!v) return new Set();
    const arr = JSON.parse(v) as string[];
    return new Set(arr || []);
  } catch {
    return new Set();
  }
};
const writeSet = (k: string, s: Set<string>) => w(k, Array.from(s.values()));

export const ProjectStore = {
  listTypes(): ProjectType[] { return r<ProjectType[]>(K.types, DEFAULT_TYPES); },
  upsertType(t: ProjectType) {
    const all = this.listTypes();
    const i = all.findIndex(x => x.key === t.key);
    if (i >= 0) all[i] = t; else all.push(t);
    w(K.types, all);
    return t;
  },

  ensureProjectDueEvent(p: Project) {
    const evId = `ev_proj_due_${p.id}`;
    const events = this.listEvents();
    const idx = events.findIndex(e => e.id === evId);

    if (!p.dueAt) {
      if (idx >= 0) {
        events.splice(idx, 1);
        w(K.events, events);
        emit('proj.events-changed');
      }
      return;
    }

    const iso = new Date(p.dueAt).toISOString();
    const next: CalendarEvent = {
      id: evId,
      projectId: p.id,
      date: iso.slice(0, 10),
      title: `Project due: ${p.name}`,
      startAt: iso,
      type: "reminder",
      description: `Due date for project: ${p.name}`,
      remindWeek: true,
      remindDay: true,
      remindHour: true,
    };

    if (idx >= 0) events[idx] = { ...events[idx], ...next };
    else events.push(next);
    w(K.events, events);
    emit('proj.events-changed');
  },

  listProjects(): Project[] { return r<Project[]>(K.projects, [{ id: "p_default", name: "Default Project" }]); },
  upsertProject(p: Project) {
    const now = new Date().toISOString();
    const next: Project = {
      status: "open",
      supervisorRole: "admin",
      createdAt: now,
      ...p,
    };
    const all = this.listProjects();
    const i = all.findIndex(x=>x.id===p.id);
    if(i>=0) {
      all[i] = { ...all[i], ...next };
    } else {
      all.push(next);
    }
    w(K.projects, all);
    emit('proj.projects-changed');
    try { this.ensureProjectDueEvent(next); } catch { void 0; }
    return next;
  },
  removeProject(id: string) {
    const all = this.listProjects().filter(p => p.id !== id);
    w(K.projects, all);
    emit('proj.projects-changed');
  },

  markReminderSent(reminderId: string) {
    const s = readSet(K.remindersSent);
    s.add(reminderId);
    writeSet(K.remindersSent, s);
  },
  reminderAlreadySent(reminderId: string) {
    const s = readSet(K.remindersSent);
    return s.has(reminderId);
  },
  listTasks(): Task[] { return r<Task[]>(K.tasks, []); },
  listTime(): TimeEntry[] { return r<TimeEntry[]>(K.time, []); },
  listBugs(): Bug[] { return r<Bug[]>(K.bugs, []); },
  listEvents(): CalendarEvent[] { return r<CalendarEvent[]>(K.events, []); },

  ensureTaskDueEvent(t: Task) {
    const evId = `ev_task_due_${t.id}`;
    const events = this.listEvents();
    const idx = events.findIndex(e => e.id === evId);
    if (!t.dueAt) {
      if (idx >= 0) {
        events.splice(idx, 1);
        w(K.events, events);
        emit('proj.events-changed');
      }
      return;
    }
    const iso = new Date(t.dueAt).toISOString();
    const next: CalendarEvent = {
      id: evId,
      projectId: t.projectId,
      date: iso.slice(0, 10),
      title: `Task due: ${t.title}`,
      startAt: iso,
      type: "task",
      description: `Due date for task: ${t.title}`,
      remindWeek: true,
      remindDay: true,
      remindHour: true,
    };
    if (idx >= 0) events[idx] = { ...events[idx], ...next };
    else events.push(next);
    w(K.events, events);
    emit('proj.events-changed');
  },

  upsertTask(t: Task) {
    const all = this.listTasks();
    const i = all.findIndex(x=>x.id===t.id);
    if(i>=0) all[i]=t; else all.push(t);
    w(K.tasks, all);
    try { this.ensureTaskDueEvent(t); } catch { void 0; }
    emit('proj.tasks-changed');
    return t;
  },
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
