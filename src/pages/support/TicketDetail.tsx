import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SupportStore, type Ticket, type Attachment, type Comment } from "@/lib/supportStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { getCurrentRole, canAccess } from "@/lib/accessControl";
import { UsersStore } from "@/lib/usersStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { notify } from "@/lib/notificationsStore";

function toDataUrl(file: File): Promise<Attachment> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Ticket | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [cFiles, setCFiles] = useState<Attachment[]>([]);
  const [closeNote, setCloseNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cannedId, setCannedId] = useState<string>("");
  const canned = SupportStore.canned();

  const refresh = () => setT(id ? SupportStore.get(id) : undefined);
  useEffect(()=>{ refresh(); }, [id]);

  const isManager = useMemo(() => {
    const role = getCurrentRole();
    return role.level === "Department" && canAccess("support","edit");
  }, []);

  if (!t) return (
    <div className="p-6">
      <div className="mb-4">
        <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      </div>
      <div>Ticket not found.</div>
    </div>
  );

  const saveTicket = (next: Ticket, action: string, details?: string) => {
    SupportStore.upsert({ ...next, updatedAt: new Date().toISOString() });
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "user", entity: "ticket", entityId: next.id, action: "update", details: details || action });
    refresh();
    if (action.startsWith("status:")) {
      const s = action.split(":")[1];
      toast({ title: `Status updated`, description: `Ticket moved to ${s.replace(/_/g,' ')}` });
      try {
        // Notify requester and assignee on status updates
        const users = UsersStore.list();
        const requester = users.find(u => u.id === next.requester);
        if (requester) notify(requester.id, "ticket", `Ticket ${next.id} status: ${s.replace(/_/g,' ')}`, next.title, `/support/tickets/${next.id}`);
        if (next.assigneeId) notify(next.assigneeId, "ticket", `Ticket ${next.id} status: ${s.replace(/_/g,' ')}`, next.title, `/support/tickets/${next.id}`);
      } catch {}
    } else if (action === "comment") {
      toast({ title: "Comment added" });
    } else if (action === "assign") {
      toast({ title: "Assignment updated", description: details });
      try {
        if (next.assigneeId) notify(next.assigneeId, "ticket", `Assigned: ${next.title}`, `You were assigned to ticket ${next.id}`, `/support/tickets/${next.id}`);
      } catch {}
    } else if (action === "request_closure") {
      toast({ title: "Closure requested" });
      try {
        if (next.assigneeId) notify(next.assigneeId, "ticket", `Closure requested: ${next.title}`, undefined, `/support/tickets/${next.id}`);
      } catch {}
    } else if (action === "approve_closure") {
      toast({ title: "Ticket closed" });
      try {
        const users = UsersStore.list();
        const requester = users.find(u => u.id === next.requester);
        if (requester) notify(requester.id, "ticket", `Ticket closed: ${next.title}`, undefined, `/support/tickets/${next.id}`);
      } catch {}
    } else if (action === "reject_closure") {
      toast({ title: "Closure rejected", description: details });
      try {
        const users = UsersStore.list();
        const requester = users.find(u => u.id === next.requester);
        if (requester) notify(requester.id, "ticket", `Closure rejected: ${next.title}`, details, `/support/tickets/${next.id}`);
      } catch {}
    }
  };

  const addComment = async () => {
    if (!comment.trim() && cFiles.length === 0) return;
    const c: Comment = { id: Math.random().toString(36).slice(2), author: "user", ts: new Date().toISOString(), message: comment, attachments: cFiles };
    const firstResponseAt = t.firstResponseAt || c.ts;
    const next: Ticket = { ...t, comments: [...t.comments, c], firstResponseAt };
    setComment(""); setCFiles([]);
    saveTicket(next, "comment");
  };

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const a = await toDataUrl(f);
    setCFiles((prev) => [...prev, a]);
  };

  const transition = (status: Ticket["status"]) => {
    const patch: Partial<Ticket> = { status };
    if (status === "resolved") patch.resolvedAt = new Date().toISOString();
    saveTicket({ ...t, ...patch } as Ticket, `status:${status}`);
  };

  const requestClosure = () => {
    if (!closeNote.trim()) return;
    const next: Ticket = { ...t, status: "pending_approval", closureRequest: { requestedBy: "user", requestedAt: new Date().toISOString(), note: closeNote }, approval: null };
    setCloseNote("");
    saveTicket(next, "request_closure", closeNote);
  };

  const approveClosure = () => {
    if (!isManager) return;
    const next: Ticket = { ...t, status: "closed", approval: { approvedBy: "manager", approvedAt: new Date().toISOString() } };
    saveTicket(next, "approve_closure");
  };

  const rejectClosure = () => {
    if (!isManager || !rejectReason.trim()) return;
    const next: Ticket = { ...t, status: "rejected", approval: { rejectedBy: "manager", rejectedAt: new Date().toISOString(), reason: rejectReason } };
    setRejectReason("");
    saveTicket(next, "reject_closure", rejectReason);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t.title}</h1>
          <p className="text-sm text-muted-foreground">Ticket {t.id} • {t.category} • <span className="capitalize">{t.priority}</span> • <span className="capitalize">{t.status.replace(/_/g,' ')}</span></p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {t.dueAt && (
              <Badge variant="secondary">SLA Due: {new Date(t.dueAt).toLocaleString()}</Badge>
            )}
            {t.firstResponseAt && <Badge variant="secondary">First Response: {new Date(t.firstResponseAt).toLocaleString()}</Badge>}
            {t.resolvedAt && <Badge variant="secondary">Resolved: {new Date(t.resolvedAt).toLocaleString()}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
          {canAccess("support","edit") && (
            <>
              {t.status === "open" && <Button onClick={()=> transition("in_progress")}>Start</Button>}
              {t.status === "in_progress" && <Button onClick={()=> transition("waiting")}>Need Info</Button>}
              {t.status === "waiting" && <Button onClick={()=> transition("in_progress")}>Resume</Button>}
              {t.status === "in_progress" && <Button onClick={()=> transition("resolved")}>Mark Resolved</Button>}
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-2">Description</h4>
            <p className="text-sm whitespace-pre-wrap">{t.description}</p>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-3">Comments</h4>
            <div className="space-y-3">
              {t.comments.map(c => (
                <div key={c.id} className="border rounded p-3">
                  <div className="text-xs text-muted-foreground mb-1">{c.author} • {new Date(c.ts).toLocaleString()}</div>
                  <div className="text-sm whitespace-pre-wrap">{c.message}</div>
                  {c.attachments && c.attachments.length>0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.attachments.map(a => (
                        <a key={a.id} href={a.dataUrl} target="_blank" className="text-xs underline">
                          {a.type.startsWith("image/") ? <img src={a.dataUrl} className="h-16 w-16 object-cover border rounded" /> : a.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <Textarea placeholder="Write a comment..." value={comment} onChange={(e)=> setComment(e.target.value)} />
              <div className="flex items-center gap-2">
                <Select value={cannedId} onValueChange={(v)=> { setCannedId(v); const found = canned.find(c => c.id===v); if(found) setComment((prev)=> (prev ? prev+"\n\n" : "") + found.body); }}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Insert canned response..." /></SelectTrigger>
                  <SelectContent>
                    {canned.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input type="file" onChange={onAttach} />
                {cFiles.map(f => (
                  <span key={f.id} className="text-xs text-muted-foreground">{f.name}</span>
                ))}
                <Button onClick={addComment}>Add Comment</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-2">Assignment</h4>
            <Select value={t.assigneeId || ""} onValueChange={(v)=> saveTicket({ ...t, assigneeId: v || undefined } as Ticket, 'assign', v || 'unassigned')}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {UsersStore.list().map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-2">Request Closure</h4>
            <Textarea placeholder="What was done? Any verification steps?" value={closeNote} onChange={(e)=> setCloseNote(e.target.value)} />
            <Button className="mt-2" onClick={requestClosure} disabled={!canAccess("support","edit") || !closeNote.trim() || !(t.status === "resolved" || t.status === "in_progress")}>Submit for Approval</Button>
            {t.closureRequest && (
              <div className="mt-3 text-xs text-muted-foreground">Requested at {new Date(t.closureRequest.requestedAt).toLocaleString()}</div>
            )}
          </div>

          {t.status === "pending_approval" && (
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-2">Manager Approval</h4>
              {isManager ? (
                <div className="space-y-2">
                  <Button onClick={approveClosure}>Approve Closure</Button>
                  <div>
                    <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e)=> setRejectReason(e.target.value)} />
                    <Button className="mt-2" variant="destructive" onClick={rejectClosure} disabled={!rejectReason.trim()}>Reject Closure</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Waiting for manager approval...</div>
              )}
            </div>
          )}

          {t.approval && t.status !== "pending_approval" && (
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-2">Approval</h4>
              <div className="text-sm">
                {t.approval.approvedBy ? (
                  <div>Approved by {t.approval.approvedBy} on {t.approval.approvedAt && new Date(t.approval.approvedAt).toLocaleString()}</div>
                ) : (
                  <div>Rejected by {t.approval.rejectedBy} on {t.approval.rejectedAt && new Date(t.approval.rejectedAt).toLocaleString()}<br/>Reason: {t.approval.reason}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;
