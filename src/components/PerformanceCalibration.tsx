import { useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Star } from "lucide-react";
import { PerformanceAdvancedStore, calibrationsCache, type CalibrationSession } from "@/lib/performanceAdvanced";
import { HRMStore } from "@/lib/hrmStore";
import { HRMDepartmentsStore } from "@/lib/hrmDepartmentsStore";

/** Radix reserves "" to mean "no selection", so a sentinel is needed instead. */
const ALL_DEPARTMENTS = "__all_departments__";

export function PerformanceCalibration() {
  // From the cache rather than copied into state. The events these listened
  // for were dispatched by the localStorage writer that no longer exists, and
  // a server read is not there on the first render anyway.
  useCache(calibrationsCache);
  const sessions = PerformanceAdvancedStore.listCalibrations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CalibrationSession | null>(null);

  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    startDate: "",
    endDate: "",
  });

  const employees = HRMStore.list();
  const departments = HRMDepartmentsStore.list();

  const save = () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    const session: CalibrationSession = {
      id: editing ? editing.id : `CAL${Date.now()}`,
      name: form.name,
      departmentId: form.departmentId || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      participants: editing ? editing.participants : [],
      finalRatings: editing ? editing.finalRatings : {},
      notes: editing ? editing.notes : {},
    };
    void PerformanceAdvancedStore.upsertCalibration(session);
    setOpen(false);
    setEditing(null);
    setForm({ name: "", departmentId: "", startDate: "", endDate: "" });
  };

  const startEdit = (s: CalibrationSession) => {
    setEditing(s);
    setForm({
      name: s.name,
      departmentId: s.departmentId ?? "",
      startDate: s.startDate,
      endDate: s.endDate,
    });
    setOpen(true);
  };

  const remove = (id: string) => {
    void PerformanceAdvancedStore.removeCalibration(id);
    };

  const addParticipant = (sessionId: string, employeeId: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;
    const updated = {
      ...s,
      participants: [...s.participants, employeeId],
    };
    void PerformanceAdvancedStore.upsertCalibration(updated);
    };

  const removeParticipant = (sessionId: string, employeeId: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;
    const updated = {
      ...s,
      participants: s.participants.filter(id => id !== employeeId),
      finalRatings: { ...s.finalRatings, [employeeId]: undefined },
      notes: { ...s.notes, [employeeId]: undefined },
    };
    void PerformanceAdvancedStore.upsertCalibration(updated);
    };

  const setFinalRating = (sessionId: string, employeeId: string, rating: number) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;
    const updated = {
      ...s,
      finalRatings: { ...s.finalRatings, [employeeId]: rating },
    };
    void PerformanceAdvancedStore.upsertCalibration(updated);
    };

  const setNotes = (sessionId: string, employeeId: string, notes: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;
    const updated = {
      ...s,
      notes: { ...s.notes, [employeeId]: notes },
    };
    void PerformanceAdvancedStore.upsertCalibration(updated);
    };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Calibration Sessions
        </h4>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", departmentId: "", startDate: "", endDate: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>
      <div className="space-y-4">
        {sessions.map((s) => (
          <Card key={s.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.departmentId ? departments.find(d => d.id === s.departmentId)?.name : "All Departments"} • {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={() => startEdit(s)}>✏️</Button>
                <Button size="icon" variant="outline" onClick={() => remove(s.id)}>🗑️</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Participants:</span>
                <div className="flex flex-wrap gap-1">
                  {s.participants.map((eid) => {
                    const emp = employees.find(e => e.id === eid);
                    return emp ? <Badge key={eid} variant="secondary">{emp.name}</Badge> : null;
                  })}
                </div>
                <Select onValueChange={(eid) => addParticipant(s.id, eid)}>
                  <SelectTrigger className="w-32 h-6 text-xs">
                    <SelectValue placeholder="Add employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => !s.participants.includes(e.id) && (!s.departmentId || e.departmentId === s.departmentId)).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                {s.participants.map((eid) => {
                  const emp = employees.find(e => e.id === eid);
                  if (!emp) return null;
                  return (
                    <div key={eid} className="flex items-center gap-2 text-sm">
                      <span>{emp.name}</span>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        placeholder="Rating"
                        value={s.finalRatings[eid] ?? ""}
                        onChange={(e) => setFinalRating(s.id, eid, parseFloat(e.target.value) || 0)}
                        className="w-20 h-6"
                      />
                      <Textarea
                        placeholder="Notes"
                        value={s.notes[eid] ?? ""}
                        onChange={(e) => setNotes(s.id, eid, e.target.value)}
                        className="h-6 text-xs"
                      />
                      <Button size="icon" variant="outline" onClick={() => removeParticipant(s.id, eid)}>🗑️</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
        {sessions.length === 0 && (
          <div className="text-center text-muted-foreground py-4">No calibration sessions.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Calibration Session" : "New Calibration Session"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Session Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department (optional)</label>
              <Select
                value={form.departmentId || ALL_DEPARTMENTS}
                onValueChange={(v) => setForm({ ...form, departmentId: v === ALL_DEPARTMENTS ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPARTMENTS}>All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
