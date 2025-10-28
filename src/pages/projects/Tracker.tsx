import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectStore } from "@/lib/projectStore";

const Tracker: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const interval = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      interval.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (interval.current) {
      clearInterval(interval.current);
      interval.current = null;
    }
    return () => { if (interval.current) clearInterval(interval.current); };
  }, [running]);

  const toggle = () => setRunning((r) => !r);
  const save = () => {
    if (seconds <= 0) return;
    ProjectStore.addTime({ id: `te_${Date.now()}`, projectId: "p_default", seconds, startedAt: new Date().toISOString() });
    setSeconds(0);
    setRunning(false);
  };

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Time Tracker</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="text-3xl font-mono tabular-nums">{h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}</div>
          <Button variant="elevated" onClick={toggle}>{running ? "Pause" : "Start"}</Button>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Tracker;
