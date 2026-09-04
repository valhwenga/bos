import React, { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, Bug as BugType } from "@/lib/projectStore";

const Bug: React.FC = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(projectsCache);
  useCache(projectTasksCache);
  useCache(projectTimeCache);
  useCache(projectBugsCache);
  useCache(projectEventsCache);
  useCache(projectTypesCache);
  const [title, setTitle] = useState("");
  const bugs = ProjectStore.listBugs();
  const add = () => {
    if (!title.trim()) return;
    void ProjectStore.upsertBug({ id: `b_${Date.now()}`, projectId: "p_default", title, severity: "med", open: true });
    setTitle("");
  };
  const toggle = (b: BugType) => {
    void ProjectStore.upsertBug({ ...b, open: !b.open });
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Bug Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="New bug title" value={title} onChange={(e)=> setTitle(e.target.value)} />
            <Button onClick={add}>Add</Button>
          </div>
          <div className="space-y-2">
            {bugs.map(b => (
              <div key={b.id} className="flex items-center justify-between border rounded-lg p-2 bg-background">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${b.open ? "bg-warning" : "bg-success"}`} />
                  <span className="text-sm">{b.title}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={()=> toggle(b)}>{b.open ? "Close" : "Reopen"}</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Bug;
