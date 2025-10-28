import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, Bug as BugType } from "@/lib/projectStore";

const Bug: React.FC = () => {
  const [title, setTitle] = useState("");
  const [bugs, setBugs] = useState<BugType[]>(ProjectStore.listBugs());
  const add = () => {
    if (!title.trim()) return;
    ProjectStore.upsertBug({ id: `b_${Date.now()}`, projectId: "p_default", title, severity: "med", open: true });
    setTitle("");
    setBugs(ProjectStore.listBugs());
  };
  const toggle = (b: BugType) => {
    ProjectStore.upsertBug({ ...b, open: !b.open });
    setBugs(ProjectStore.listBugs());
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
            <Button variant="elevated" onClick={add}>Add</Button>
          </div>
          <div className="space-y-2">
            {bugs.map(b => (
              <div key={b.id} className="flex items-center justify-between border rounded-lg p-2 bg-background">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${b.open ? "bg-amber-500" : "bg-emerald-500"}`} />
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
