import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, TimeEntry } from "@/lib/projectStore";

const Timesheet: React.FC = () => {
  const [seconds, setSeconds] = useState(3600);
  const [taskId, setTaskId] = useState("");
  const [entries, setEntries] = useState<TimeEntry[]>(ProjectStore.listTime());
  const tasks = ProjectStore.listTasks();
  const totalHrs = useMemo(() => entries.reduce((s, e) => s + e.seconds, 0) / 3600, [entries]);

  const add = () => {
    const te: TimeEntry = { id: `te_${Date.now()}`, projectId: "p_default", taskId: taskId || undefined, seconds, startedAt: new Date().toISOString() };
    ProjectStore.addTime(te);
    setEntries(ProjectStore.listTime());
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Timesheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Task</label>
              <select className="h-10 rounded-md border bg-background px-3" value={taskId} onChange={(e)=> setTaskId(e.target.value)}>
                <option value="">Unassigned</option>
                {tasks.map(t=> <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="grid gap-1 w-40">
              <label className="text-xs text-muted-foreground">Seconds</label>
              <Input type="number" value={seconds} onChange={(e)=> setSeconds(parseInt(e.target.value||"0"))} />
            </div>
            <Button variant="elevated" onClick={add}>Log Time</Button>
            <div className="ml-auto text-sm text-muted-foreground">Total: {totalHrs.toFixed(2)}h</div>
          </div>
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between border rounded-lg p-2 bg-background">
                <span className="text-sm">{e.taskId ? tasks.find(t=>t.id===e.taskId)?.title : "Unassigned"}</span>
                <span className="text-sm">{(e.seconds/3600).toFixed(2)} h</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Timesheet;
