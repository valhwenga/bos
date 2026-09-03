/**
 * Projects, tasks, time, bugs and the project calendar.
 *
 * All of these were localStorage arrays, so a project assigned on one machine
 * did not exist on any other and a bug raised against it was visible only to
 * whoever raised it. They are rows now, behind the `projects` module's access
 * rules.
 *
 * Reads stay synchronous from caches because the screens read during render;
 * writes are async and go to the server.
 */

import { createCache } from "./collectionCache";
import {
  BugRepo,
  CalendarRepo,
  ProjectRepo,
  ProjectTypeRepo,
  TaskRepo,
  TimeEntryRepo,
} from "./projectRepo";

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

export const projectsCache = createCache<Project>(() => ProjectRepo.list());
export const projectTasksCache = createCache<Task>(() => TaskRepo.list());
export const projectTimeCache = createCache<TimeEntry>(() => TimeEntryRepo.list());
export const projectBugsCache = createCache<Bug>(() => BugRepo.list());
export const projectEventsCache = createCache<CalendarEvent>(() => CalendarRepo.list());
export const projectTypesCache = createCache<ProjectType>(() => ProjectTypeRepo.list());

const emit = (name: string) => {
  try {
    window.dispatchEvent(new Event(name));
  } catch {
    void 0;
  }
};

export const ProjectStore = {
  // --- Reads: synchronous, from the caches -------------------------------

  listTypes(): ProjectType[] {
    return projectTypesCache.list();
  },
  listProjects(): Project[] {
    return projectsCache.list();
  },
  listTasks(): Task[] {
    return projectTasksCache.list();
  },
  listTime(): TimeEntry[] {
    return projectTimeCache.list();
  },
  listBugs(): Bug[] {
    return projectBugsCache.list();
  },
  listEvents(): CalendarEvent[] {
    return projectEventsCache.list();
  },

  /** Loads everything the project screens read. */
  async load(): Promise<void> {
    await Promise.all([
      projectTypesCache.ensureLoaded(),
      projectsCache.ensureLoaded(),
      projectTasksCache.ensureLoaded(),
      projectTimeCache.ensureLoaded(),
      projectBugsCache.ensureLoaded(),
      projectEventsCache.ensureLoaded(),
    ]);
  },

  // --- Writes ------------------------------------------------------------

  async upsertType(t: ProjectType): Promise<ProjectType> {
    await projectTypesCache.mutate(() => ProjectTypeRepo.upsert(t));
    return t;
  },

  async upsertProject(p: Project): Promise<Project> {
    await projectsCache.mutate(() => ProjectRepo.upsert(p));
    // The calendar entry is derived from the due date, so it is kept in step
    // here rather than left to whichever screen happened to save the project.
    try {
      await this.ensureProjectDueEvent(p);
    } catch {
      void 0;
    }
    emit("proj.projects-changed");
    return p;
  },

  async removeProject(id: string): Promise<void> {
    await projectsCache.mutate(() => ProjectRepo.remove(id));
    emit("proj.projects-changed");
  },

  async upsertTask(t: Task): Promise<Task> {
    await projectTasksCache.mutate(() => TaskRepo.upsert(t));
    try {
      await this.ensureTaskDueEvent(t);
    } catch {
      void 0;
    }
    emit("proj.tasks-changed");
    return t;
  },

  async removeTask(id: string): Promise<void> {
    await projectTasksCache.mutate(() => TaskRepo.remove(id));
    emit("proj.tasks-changed");
  },

  async upsertBug(b: Bug): Promise<Bug> {
    await projectBugsCache.mutate(() => BugRepo.upsert(b));
    return b;
  },

  async addTime(te: TimeEntry): Promise<TimeEntry> {
    await projectTimeCache.mutate(() => TimeEntryRepo.add(te));
    return te;
  },

  async addEvent(ev: CalendarEvent): Promise<CalendarEvent> {
    await projectEventsCache.mutate(() => CalendarRepo.upsert(ev));
    emit("proj.events-changed");
    return ev;
  },

  async updateEvent(ev: CalendarEvent): Promise<CalendarEvent> {
    await projectEventsCache.mutate(() => CalendarRepo.upsert(ev));
    emit("proj.events-changed");
    return ev;
  },

  async removeEvent(id: string): Promise<void> {
    await projectEventsCache.mutate(() => CalendarRepo.remove(id));
    emit("proj.events-changed");
  },

  // --- Derived calendar entries ------------------------------------------

  /**
   * Keeps the calendar entry for a project's due date in step with the project.
   *
   * Removing the due date removes the entry, rather than leaving a deadline in
   * the calendar for something that no longer has one.
   */
  async ensureProjectDueEvent(p: Project): Promise<void> {
    const eventId = `ev_proj_due_${p.id}`;
    const existing = this.listEvents().find((e) => e.id === eventId);

    if (!p.dueAt) {
      if (existing) await this.removeEvent(eventId);
      return;
    }

    const at = new Date(p.dueAt).toISOString();
    await projectEventsCache.mutate(() =>
      CalendarRepo.upsert({
        id: eventId,
        projectId: p.id,
        date: at.slice(0, 10),
        title: `Project due: ${p.name}`,
        startAt: at,
        type: "reminder",
        description: `Due date for project: ${p.name}`,
        remindWeek: true,
        remindDay: true,
        remindHour: true,
      }),
    );
    emit("proj.events-changed");
  },

  async ensureTaskDueEvent(t: Task): Promise<void> {
    const eventId = `ev_task_due_${t.id}`;
    const existing = this.listEvents().find((e) => e.id === eventId);

    if (!t.dueAt) {
      if (existing) await this.removeEvent(eventId);
      return;
    }

    const at = new Date(t.dueAt).toISOString();
    await projectEventsCache.mutate(() =>
      CalendarRepo.upsert({
        id: eventId,
        projectId: t.projectId,
        date: at.slice(0, 10),
        title: `Task due: ${t.title}`,
        startAt: at,
        type: "task",
        description: `Due date for task: ${t.title}`,
        remindWeek: true,
        remindDay: true,
        remindHour: true,
      }),
    );
    emit("proj.events-changed");
  },

  // --- Reminders ---------------------------------------------------------
  //
  // Recorded server-side. The list of "already sent" ids used to be per
  // browser, so opening the app on a second machine re-sent every reminder
  // that machine had not seen.

  markReminderSent(reminderId: string): Promise<boolean> {
    return CalendarRepo.claimReminder(reminderId);
  },

  reminderAlreadySent(reminderId: string): Promise<boolean> {
    return CalendarRepo.reminderAlreadySent(reminderId);
  },

  // --- Comments and task updates -----------------------------------------
  //
  // Appended to the record rather than kept in their own table: they are short
  // notes read only with the thing they belong to, and never queried across
  // projects.

  async addProjectComment(projectId: string, c: Comment): Promise<void> {
    const project = this.listProjects().find((p) => p.id === projectId);
    if (!project) return;
    await this.upsertProject({ ...project, comments: [...(project.comments ?? []), c] });
  },

  async addTaskUpdate(taskId: string, u: TaskUpdate): Promise<void> {
    const task = this.listTasks().find((t) => t.id === taskId);
    if (!task) return;
    await this.upsertTask({ ...task, updates: [...(task.updates ?? []), u] });
  },
};
