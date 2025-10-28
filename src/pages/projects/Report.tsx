import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectStore, type Project, type Task, type TimeEntry } from "@/lib/projectStore";
import { CustomersStore } from "@/lib/customersStore";

const Report: React.FC = () => {
  const projects = ProjectStore.listProjects();
  const [projectId, setProjectId] = useState(projects[0]?.id || "p_default");

  const project: Project | undefined = projects.find(p=> p.id === projectId) || projects[0];
  const tasks: Task[] = ProjectStore.listTasks().filter(t=> !project || t.projectId === project.id);
  const time: TimeEntry[] = ProjectStore.listTime().filter(t=> !project || t.projectId === project.id);
  const customer = project?.customerId ? CustomersStore.list().find(c=> c.id === project.customerId) : undefined;

  const stats = useMemo(() => {
    const totalHrs = time.reduce((s, e) => s + e.seconds, 0) / 3600;
    const todo = tasks.filter(t=>t.status==='todo').length;
    const inprogress = tasks.filter(t=>t.status==='inprogress').length;
    const done = tasks.filter(t=>t.status==='done').length;
    return { totalHrs, todo, inprogress, done };
  }, [tasks, time]);

  const recentUpdates = useMemo(() => {
    return tasks.flatMap(t => (t.updates || []).map(u => ({ task: t, update: u })))
      .sort((a,b)=> (b.update.createdAt > a.update.createdAt ? 1 : -1))
      .slice(0, 10);
  }, [tasks]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project Report</h1>
        <div className="flex items-center gap-2">
          <select className="h-10 rounded-md border bg-background px-3" value={project?.id} onChange={(e)=> setProjectId(e.target.value)}>
            {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Customer</div>
              <div className="text-2xl font-semibold">{customer?.name || "—"}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Start Date</div>
              <div className="text-2xl font-semibold">{project?.startDate || "—"}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">End Date</div>
              <div className="text-2xl font-semibold">{project?.endDate || "—"}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Total Hours</div>
              <div className="text-2xl font-semibold">{stats.totalHrs.toFixed(2)}h</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Tasks: To do</div>
              <div className="text-2xl font-semibold">{stats.todo}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Tasks: In progress</div>
              <div className="text-2xl font-semibold">{stats.inprogress}</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm text-muted-foreground">Tasks: Done</div>
              <div className="text-2xl font-semibold">{stats.done}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Description & Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm whitespace-pre-wrap">{project?.description || "No description yet."}</div>
            </div>
            <div>
              <div className="font-medium mb-2">Milestones</div>
              <div className="flex flex-wrap gap-2">
                {(project?.milestones || []).length === 0 && <div className="text-sm text-muted-foreground">No milestones yet.</div>}
                {(project?.milestones || []).map(m=> (
                  <div key={m.id} className="px-3 py-1 rounded-full bg-secondary text-xs">
                    {m.title}{m.dueDate ? ` · ${m.dueDate}` : ""}{m.status ? ` · ${m.status}` : ""}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(project?.files || []).length === 0 && <div className="text-sm text-muted-foreground">No files uploaded.</div>}
            {(project?.files || []).map(f=> (
              <a key={f.id} href={f.dataUrl || "#"} target="_blank" className="block text-sm underline break-words">
                {f.name} <span className="text-muted-foreground">({(f.size/1024).toFixed(1)} KB)</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Task Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUpdates.length === 0 && <div className="text-sm text-muted-foreground">No updates yet.</div>}
            {recentUpdates.map(({ task, update }) => (
              <div key={update.id} className="border rounded-lg p-2 bg-background">
                <div className="text-xs text-muted-foreground">{new Date(update.createdAt).toLocaleString()}</div>
                <div className="text-sm"><span className="font-medium">{task.title}:</span> {update.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">To do: {stats.todo}</div>
            <div className="text-sm">In progress: {stats.inprogress}</div>
            <div className="text-sm">Done: {stats.done}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Report;
