import { useEffect, useMemo, useState } from "react";
import { MessengerStore, type Conversation } from "@/lib/messengerStore";
import { useAccounts, useStaffAccounts } from "@/lib/useAccounts";
import { AuthStore } from "@/lib/authStore";
import { PenSquare, Search, UsersRound, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input as TextInput } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const Conversations = () => {
  const [list, setList] = useState<Conversation[]>(MessengerStore.listConversations());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberQ, setMemberQ] = useState("");
  const users = useAccounts();
  const staff = useStaffAccounts();

  const refresh = () => setList(MessengerStore.listConversations());
  useEffect(()=>{ refresh(); }, []);

  const filtered = useMemo(() => list.filter(c => {
    const hay = `${c.name||''} ${c.members.map(id=> users.find(u=>u.id===id)?.name||'').join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q, users]);

  const startNew = (group: boolean) => { setIsGroup(group); setName(""); setMembers([]); setOpen(true); };
  const save = () => {
    const me = AuthStore.currentUser()?.id;
    if (!me) return;
    const mem = Array.from(new Set([...members, me]));
    MessengerStore.createConversation(isGroup, mem, isGroup ? name : undefined);
    setOpen(false); refresh();
  };

  const navigate = useNavigate();

  const me = AuthStore.currentUser()?.id;

  const titleFor = (c: Conversation) =>
    c.isGroup
      ? c.name || "Group"
      : c.members.filter((id) => id !== me).map((id) => users.find((u) => u.id === id)?.name || id).join(", ") || "Direct message";

  const previewFor = (c: Conversation) => {
    const msgs = MessengerStore.messagesFor(c.id);
    const last = msgs[msgs.length - 1];
    if (!last) return "No messages yet";
    const who = last.authorId === me ? "You" : users.find((u) => u.id === last.authorId)?.name?.split(" ")[0] || "";
    return `${who ? who + ": " : ""}${last.body || (last.attachments?.length ? "Attachment" : "")}`;
  };

  const whenFor = (c: Conversation) => {
    if (!c.lastMessageAt) return "";
    const d = new Date(c.lastMessageAt);
    return new Date().toDateString() === d.toDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString();
  };

  const unreadFor = (c: Conversation) => (me ? c.unreadBy?.[me] || 0 : 0);

  // Most recently active first — the list was previously in insertion order.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "")),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Messenger"
        description="Direct and group conversations with your team."
        breadcrumbs={[{ label: "Messenger" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => startNew(true)}>
              <UsersRound className="mr-2 h-4 w-4" aria-hidden="true" />
              New group
            </Button>
            <Button onClick={() => startNew(false)}>
              <PenSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              New message
            </Button>
          </>
        }
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="h-9 pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        {ordered.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            variant={list.length ? "search" : "empty"}
            title={list.length ? "No conversations match" : "No conversations yet"}
            description={list.length ? "Try a different name." : "Start a direct message or create a group to get talking."}
            action={list.length ? undefined : <Button onClick={() => startNew(false)}>New message</Button>}
          />
        ) : (
          <ul>
            {ordered.map((c) => {
              const unread = unreadFor(c);
              const title = titleFor(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/messenger/${c.id}`)}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors duration-fast ease-standard last:border-0 hover:bg-surface-raised"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                        c.isGroup ? "bg-info-soft text-info" : "bg-primary text-primary-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {c.isGroup ? <UsersRound className="h-4 w-4" /> : title.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-baseline gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "text-foreground")}>
                          {title}
                        </span>
                        {c.isGroup && (
                          <span className="shrink-0 text-xs text-subtle">{c.members.length} members</span>
                        )}
                      </span>
                      <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                        {previewFor(c)}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">{whenFor(c)}</span>
                      {unread > 0 && (
                        <span className="min-w-4 rounded-full bg-primary px-1.5 text-center text-2xs font-medium text-primary-foreground">
                          {unread}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{isGroup ? 'New Group' : 'New Message'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {isGroup && (
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Group Name</label>
                <Input value={name} onChange={(e)=> setName(e.target.value)} />
              </div>
            )}
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Members</label>
              <TextInput placeholder="Search people..." value={memberQ} onChange={(e)=> setMemberQ(e.target.value)} />
              <div className="max-h-56 overflow-y-auto mt-2 border rounded">
                {staff
                  .filter(u => (u.name+" "+u.email).toLowerCase().includes(memberQ.toLowerCase()))
                  .map(u => {
                    const selected = members.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={()=> setMembers(prev => selected ? prev.filter(x=> x!==u.id) : [...prev, u.id])}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 ${selected ? 'bg-primary/10' : ''}`}
                      >
                        <span>{u.name}</span>
                        <span className={`h-4 w-4 rounded border ${selected ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                      </button>
                    );
                  })}
                {staff.filter(u => (u.name+" "+u.email).toLowerCase().includes(memberQ.toLowerCase())).length===0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map(id => (
                  <span key={id} className="text-xs border rounded px-2 py-1">
                    {users.find(u=>u.id===id)?.name||id}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={isGroup ? !name.trim() || members.length===0 : members.length===0}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conversations;
