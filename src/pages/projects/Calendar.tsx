import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectStore, CalendarEvent, Task, CalendarEventType } from "@/lib/projectStore";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

const Calendar: React.FC = () => {
  const [selected, setSelected] = useState<Date>(new Date());
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("task");
  const [time, setTime] = useState<string>(new Date().toISOString().slice(0,16));
  const [description, setDescription] = useState("");
  const [remindWeek, setRemindWeek] = useState(true);
  const [remindDay, setRemindDay] = useState(true);
  const [remindHour, setRemindHour] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>(ProjectStore.listEvents());
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [addForTask, setAddForTask] = useState<Task | null>(null);
  const tasks: Task[] = ProjectStore.listTasks();
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const filtered = useMemo(() => events.filter(e => e.date === dateKey(selected)), [events, selected]);

  const add = () => {
    if (!title.trim()) return;
    const startAtIso = time ? new Date(time).toISOString() : new Date(selected).toISOString();
    const ev: CalendarEvent = { id: `ev_${Date.now()}`, date: dateKey(selected), title, projectId: "p_default", startAt: startAtIso, type, description, remindWeek, remindDay, remindHour };
    ProjectStore.addEvent(ev);
    setEvents(ProjectStore.listEvents());
    setTitle("");
    setDescription("");
  };

  // Marked days with events (by type) for colored rings in the calendar
  const typeDates = useMemo(() => {
    const by = { task: [] as Date[], meeting: [] as Date[], reminder: [] as Date[], other: [] as Date[] };
    events.forEach(e => {
      const d = new Date(e.date);
      const t = (e.type || 'task') as CalendarEventType;
      if (t === 'task') by.task.push(d);
      else if (t === 'meeting') by.meeting.push(d);
      else if (t === 'reminder') by.reminder.push(d);
      else by.other.push(d);
    });
    return by;
  }, [events]);
  const modifiers = { hasTask: typeDates.task, hasMeeting: typeDates.meeting, hasReminder: typeDates.reminder, hasOther: typeDates.other };
  const typeBadge = (t?: CalendarEventType) => {
    switch (t) {
      case "task": return "bg-blue-100 text-blue-800";
      case "meeting": return "bg-emerald-100 text-emerald-800";
      case "reminder": return "bg-amber-100 text-amber-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  useEffect(() => {
    const onChange = () => setEvents(ProjectStore.listEvents());
    window.addEventListener('proj.events-changed', onChange as any);
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('proj.events')) onChange(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('proj.events-changed', onChange as any); window.removeEventListener('storage', onStorage); };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Project Calendar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border p-4 bg-background lg:col-span-2">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              modifiers={modifiers}
              modifiersClassNames={{
                hasTask: "rounded-md ring-2 ring-blue-500",
                hasMeeting: "rounded-md ring-2 ring-emerald-500",
                hasReminder: "rounded-md ring-2 ring-amber-500",
                hasOther: "rounded-md ring-2 ring-slate-500",
              }}
            />
          </div>
          <div className="space-y-3">
            <div className="grid gap-2">
              <div className="flex gap-2">
                <Input placeholder="Title" value={title} onChange={(e)=> setTitle(e.target.value)} />
                <select className="border rounded px-2 text-sm bg-background text-foreground" value={type} onChange={(e)=> setType(e.target.value as CalendarEventType)}>
                  <option value="task">Task</option>
                  <option value="meeting">Meeting</option>
                  <option value="reminder">Reminder</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="datetime-local" value={time} onChange={(e)=> setTime(e.target.value)} />
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={remindWeek} onChange={(e)=> setRemindWeek(e.target.checked)} /> 1w</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={remindDay} onChange={(e)=> setRemindDay(e.target.checked)} /> 1d</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={remindHour} onChange={(e)=> setRemindHour(e.target.checked)} /> 1h</label>
                </div>
              </div>
              <Input placeholder="Description (optional)" value={description} onChange={(e)=> setDescription(e.target.value)} />
              <div className="flex justify-end"><Button variant="elevated" onClick={add}>Add</Button></div>
            </div>
            <div className="space-y-2">
              {filtered.map(e => (
                <div key={e.id} className="border rounded-lg p-2 bg-background text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {e.title}
                        {e.type ? <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full capitalize ${typeBadge(e.type)}`}>{e.type}</span> : null}
                      </div>
                      {e.startAt && <div className="text-xs text-muted-foreground">{new Date(e.startAt).toLocaleString()}</div>}
                      {e.description && <div className="text-xs mt-1">{e.description}</div>}
                      <div className="text-[11px] text-muted-foreground mt-1">Remind: {e.remindWeek?"1w ":""}{e.remindDay?"1d ":""}{e.remindHour?"1h":""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={()=> setEditEvent(e)}>View / Edit</Button>
                      <Button size="sm" variant="destructive" onClick={()=> { ProjectStore.removeEvent(e.id); setEvents(ProjectStore.listEvents()); }}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length===0 && <div className="text-sm text-muted-foreground">No events for this day.</div>}
            </div>
            <div className="pt-4">
              <div className="text-sm font-medium mb-2">Tasks</div>
              <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                {tasks.length === 0 && <div className="text-sm text-muted-foreground">No tasks yet.</div>}
                {tasks.map(t => (
                  <div key={t.id} className="border rounded-lg p-2 bg-background text-sm">
                    <div className="flex items-center justify-between">
                      <span>{t.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{t.status}</span>
                    </div>
                    <div className="mt-2 flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" onClick={()=> setEditTask(t)}>View / Edit</Button>
                      <Button size="sm" onClick={()=> setAddForTask(t)}>Add to Calendar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit/View Event Dialog */}
      <Dialog open={!!editEvent} onOpenChange={(v)=> { if(!v) setEditEvent(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>View / Edit Event</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={editEvent.title} onChange={(e)=> setEditEvent({ ...editEvent, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select className="border rounded px-2 text-sm bg-background text-foreground w-full h-10" value={editEvent.type || 'task'} onChange={(e)=> setEditEvent({ ...editEvent, type: e.target.value as CalendarEventType })}>
                    <option value="task">Task</option>
                    <option value="meeting">Meeting</option>
                    <option value="reminder">Reminder</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">When</label>
                  <Input type="datetime-local" value={(editEvent.startAt ? new Date(editEvent.startAt) : new Date()).toISOString().slice(0,16)} onChange={(e)=> setEditEvent({ ...editEvent, startAt: new Date(e.target.value).toISOString(), date: new Date(e.target.value).toISOString().slice(0,10) })} />
                </div>
              </div>
              <label className="text-xs text-muted-foreground mt-2">Description</label>
              <Input value={editEvent.description||''} onChange={(e)=> setEditEvent({ ...editEvent, description: e.target.value })} />
              <div className="flex items-center gap-3 text-sm mt-2">
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!editEvent.remindWeek} onChange={(e)=> setEditEvent({ ...editEvent, remindWeek: e.target.checked })} /> 1w</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!editEvent.remindDay} onChange={(e)=> setEditEvent({ ...editEvent, remindDay: e.target.checked })} /> 1d</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!editEvent.remindHour} onChange={(e)=> setEditEvent({ ...editEvent, remindHour: e.target.checked })} /> 1h</label>
              </div>
          </div>)}
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setEditEvent(null)}>Close</Button>
            {editEvent && <Button onClick={()=> { ProjectStore.updateEvent(editEvent); setEvents(ProjectStore.listEvents()); setEditEvent(null); }}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/View Task Dialog */}
      <Dialog open={!!editTask} onOpenChange={(v)=> { if(!v) setEditTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>View / Edit Task</DialogTitle></DialogHeader>
          {editTask && (
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={editTask.title} onChange={(e)=> setEditTask({ ...editTask, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="border rounded px-2 text-sm bg-background text-foreground w-full h-10" value={editTask.status} onChange={(e)=> setEditTask({ ...editTask, status: e.target.value as any })}>
                    <option value="todo">To do</option>
                    <option value="inprogress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Assigned To</label>
                  <Input value={editTask.assignedTo||''} onChange={(e)=> setEditTask({ ...editTask, assignedTo: e.target.value })} />
                </div>
              </div>
              <label className="text-xs text-muted-foreground mt-2">Description</label>
              <Input value={editTask.description||''} onChange={(e)=> setEditTask({ ...editTask, description: e.target.value })} />
          </div>)}
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setEditTask(null)}>Close</Button>
            {editTask && <Button onClick={()=> { ProjectStore.upsertTask(editTask); setEditTask(null); }}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task to Calendar Dialog (date + prompt time) */}
      <Dialog open={!!addForTask} onOpenChange={(v)=> { if(!v) setAddForTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task to Calendar</DialogTitle></DialogHeader>
          {addForTask && (
            <div className="grid gap-2">
              <div className="text-sm">{addForTask.title}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select className="border rounded px-2 text-sm bg-background text-foreground w-full h-10" defaultValue="task" id="add-type">
                    <option value="task">Task</option>
                    <option value="meeting">Meeting</option>
                    <option value="reminder">Reminder</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" defaultValue={selected.toISOString().slice(0,10)} id="add-date" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Time</label>
                    <Input type="time" id="add-time" placeholder="HH:MM" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setAddForTask(null)}>Cancel</Button>
            {addForTask && <Button onClick={()=> {
              const d = (document.getElementById('add-date') as HTMLInputElement)?.value;
              const tval = (document.getElementById('add-time') as HTMLInputElement)?.value;
              if (!d) { alert('Please pick a date'); return; }
              if (!tval) { alert('Please pick a time'); (document.getElementById('add-time') as HTMLInputElement)?.focus(); return; }
              const when = `${d}T${tval}`;
              const typeSel = (document.getElementById('add-type') as HTMLSelectElement)?.value as CalendarEventType;
              const iso = new Date(when).toISOString();
              const ev: CalendarEvent = { id: `ev_${Date.now()}`, projectId: addForTask.projectId, title: addForTask.title, date: iso.slice(0,10), startAt: iso, type: typeSel, description: addForTask.description };
              ProjectStore.addEvent(ev); setEvents(ProjectStore.listEvents()); setAddForTask(null);
            }}>Add</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
