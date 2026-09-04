import { useCallback, useEffect, useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { ticketsCache } from "@/lib/supportStore";
import { clientsCache } from "@/lib/clientsStore";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SupportStore, type Ticket, type Attachment, type Comment } from "@/lib/supportStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { sendEmail } from "@/lib/sendDocument";
import { SendIdentities, sendIdentitiesCache } from "@/lib/sendIdentities";
import { getCurrentRole, canAccess } from "@/lib/accessControl";
import { useAccounts, useStaffAccounts } from "@/lib/useAccounts";
import { AuthStore } from "@/lib/authStore";
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

/** Radix reserves "" to mean "no selection", so a sentinel is needed instead. */
const UNASSIGNED = "__unassigned__";

const TicketDetail = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(ticketsCache);
  useCache(sendIdentitiesCache);
  useCache(clientsCache);
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Ticket | undefined>(undefined);
  const [comment, setComment] = useState("");
  // Defaults on for a ticket raised by email, off for one raised internally.
  const [emailReply, setEmailReply] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [cFiles, setCFiles] = useState<Attachment[]>([]);
  const [closeNote, setCloseNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cannedId, setCannedId] = useState<string>("");
  const canned = SupportStore.canned();
  const users = useAccounts();
  const staff = useStaffAccounts();

  const refresh = useCallback(() => {
    setT(id ? SupportStore.get(id) : undefined);
  }, [id]);
  useEffect(()=>{ refresh(); }, [refresh]);

  const isManager = useMemo(() => {
    const role = getCurrentRole();
    return role.level === "Department" && canAccess("support","edit");
  }, []);

  const acc = AuthStore.currentUser();
  const me = acc?.id;
  const myClientId = acc?.clientId;

  useEffect(() => {
    if (!myClientId) return;
    if (!t) return;
    if (t.clientId !== myClientId) navigate(-1);
  }, [myClientId, t, navigate]);
  const applyDuePreset = (hours: number) => {
    const iso = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    saveTicket({ ...t, dueAt: iso } as Ticket, "sla_due", `SLA due set to ${new Date(iso).toLocaleString()}`);
  };

  if (!t) return (
    <div className="p-6">
      <div className="mb-4">
        <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      </div>
      <div>Ticket not found.</div>
    </div>
  );

  const saveTicket = (next: Ticket, action: string, details?: string) => {
    void SupportStore.upsert({ ...next, updatedAt: new Date().toISOString() });
    void AuditLogStore.append({ entity: "ticket", entityId: next.id, action: "update", details: details || action });
    refresh();
    if (action.startsWith("status:")) {
      const s = action.split(":")[1];
      toast({ title: `Status updated`, description: `Ticket moved to ${s.replace(/_/g,' ')}` });
      try {
        // Notify requester and assignee on status updates
        const requester = users.find(u => u.id === next.requester);
        if (requester) void notify(requester.id, "ticket", `Ticket ${next.id} status: ${s.replace(/_/g,' ')}`, next.title, `/support/tickets/${next.id}`);
        if (next.assigneeId) void notify(next.assigneeId, "ticket", `Ticket ${next.id} status: ${s.replace(/_/g,' ')}`, next.title, `/support/tickets/${next.id}`);
      } catch { void 0; }
    } else if (action === "comment") {
      toast({ title: "Comment added" });
    } else if (action === "assign") {
      toast({ title: "Assignment updated", description: details });
      try {
        if (next.assigneeId) void notify(next.assigneeId, "ticket", `Assigned: ${next.title}`, `You were assigned to ticket ${next.id}`, `/support/tickets/${next.id}`);
      } catch { void 0; }
    } else if (action === "request_closure") {
      toast({ title: "Closure requested" });
      try {
        if (next.assigneeId) void notify(next.assigneeId, "ticket", `Closure requested: ${next.title}`, undefined, `/support/tickets/${next.id}`);
      } catch { void 0; }
    } else if (action === "approve_closure") {
      toast({ title: "Ticket closed" });
      try {
        const requester = users.find(u => u.id === next.requester);
        if (requester) void notify(requester.id, "ticket", `Ticket closed: ${next.title}`, undefined, `/support/tickets/${next.id}`);
      } catch { void 0; }
    } else if (action === "reject_closure") {
      toast({ title: "Closure rejected", description: details });
      try {
        const requester = users.find(u => u.id === next.requester);
        if (requester) void notify(requester.id, "ticket", `Closure rejected: ${next.title}`, details, `/support/tickets/${next.id}`);
      } catch { void 0; }
    }
  };

  const addComment = async () => {
    if (!comment.trim() && cFiles.length === 0) return;
    const c: Comment = { id: Math.random().toString(36).slice(2), author: "user", ts: new Date().toISOString(), message: comment, attachments: cFiles };
    const firstResponseAt = t.firstResponseAt || c.ts;
    const next: Ticket = { ...t, comments: [...t.comments, c], firstResponseAt };
    const text = comment;
    setComment(""); setCFiles([]);
    saveTicket(next, "comment");

    // A ticket that arrived by email is a conversation with somebody outside
    // the system. A comment they never receive leaves them waiting while the
    // ticket looks answered from in here, so it goes to them as well — with the
    // reference in the subject, which is what threads their reply back onto
    // this ticket rather than opening a new one.
    if (emailReply && t.requesterEmail && text.trim()) {
      setEmailing(true);
      try {
        const result = await sendEmail({
          to: t.requesterEmail,
          subject: `[${t.reference ?? t.id}] ${t.title}`,
          body: text,
          module: "support",
          // From the address they wrote to, so their next reply comes back to
          // the queue rather than to whoever the default happens to be.
          fromIdentity: SendIdentities.forAddress(t.inboxAddress)?.address,
        });
        toast({
          title: "Replied",
          description: `Emailed to ${t.requesterEmail}${result.from ? ` from ${result.from}` : ""}.`,
        });
      } catch (err: unknown) {
        toast({
          title: "Comment saved, but not emailed",
          description: err instanceof Error ? err.message : "The mail server refused it.",
          variant: "destructive",
        });
      } finally {
        setEmailing(false);
      }
    }
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
          <p className="text-sm text-muted-foreground">{t.reference ?? `Ticket ${t.id}`} • {t.category} • <span className="capitalize">{t.priority}</span> • <span className="capitalize">{t.status.replace(/_/g,' ')}</span></p>
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
              <Textarea placeholder={t.requesterEmail ? "Write a reply..." : "Write a comment..."} value={comment} onChange={(e)=> setComment(e.target.value)} />
              {t.requesterEmail && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={emailReply}
                    onChange={(e) => setEmailReply(e.target.checked)}
                  />
                  Email this to {t.requesterEmail}
                </label>
              )}
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
                <Button onClick={() => void addComment()} disabled={emailing}>
                  {emailing ? "Sending…" : t.requesterEmail && emailReply ? "Reply to customer" : "Add comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-2">Assignment</h4>
            <div className="grid gap-2">
              <Select
                value={t.assigneeId || UNASSIGNED}
                onValueChange={(v)=> saveTicket({ ...t, assigneeId: v === UNASSIGNED ? undefined : v } as Ticket, 'assign', v === UNASSIGNED ? 'unassigned' : users.find(u => u.id === v)?.name ?? v)}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {staff.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button variant="secondary" disabled={!me} onClick={()=> { if(!me) return; saveTicket({ ...t, assigneeId: me } as Ticket, 'assign', 'self'); }}>Assign to me</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-1">
              <label className="text-xs text-muted-foreground">Expiry / SLA Due</label>
              <div className="grid gap-2">
                <Input type="datetime-local" value={t.dueAt ? new Date(t.dueAt).toISOString().slice(0,16) : ""} onChange={(e)=> saveTicket({ ...t, dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } as Ticket, "sla_due", "SLA due updated") } />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={()=> applyDuePreset(1)}>+1h</Button>
                  <Button type="button" variant="secondary" onClick={()=> applyDuePreset(24)}>+1d</Button>
                  <Button type="button" variant="secondary" onClick={()=> applyDuePreset(24*7)}>+1w</Button>
                </div>
              </div>
            </div>
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
