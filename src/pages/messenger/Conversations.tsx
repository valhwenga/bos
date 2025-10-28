import { useEffect, useMemo, useState } from "react";
import { MessengerStore, type Conversation } from "@/lib/messengerStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
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
  const users = UsersStore.list();

  const refresh = () => setList(MessengerStore.listConversations());
  useEffect(()=>{ refresh(); }, []);

  const filtered = useMemo(() => list.filter(c => {
    const hay = `${c.name||''} ${c.members.map(id=> users.find(u=>u.id===id)?.name||'').join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q, users]);

  const startNew = (group: boolean) => { setIsGroup(group); setName(""); setMembers([]); setOpen(true); };
  const save = () => {
    const me = UsersStore.list()[0]?.id || "me";
    const mem = Array.from(new Set([...members, me]));
    MessengerStore.createConversation(isGroup, mem, isGroup ? name : undefined);
    setOpen(false); refresh();
  };

  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Messenger</h1>
          <p className="text-sm text-muted-foreground">Direct and group conversations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={()=> startNew(false)}>New Message</Button>
          <Button variant="secondary" onClick={()=> startNew(true)}>New Group</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="Search conversations..." value={q} onChange={(e)=> setQ(e.target.value)} className="w-64" />
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-3 text-sm">NAME</th>
                <th className="text-left p-3 text-sm">MEMBERS</th>
                <th className="text-left p-3 text-sm">LAST MESSAGE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-secondary/30 cursor-pointer" onClick={()=> navigate(`/messenger/${c.id}`)}>
                  <td className="p-3 text-sm">{c.isGroup ? (c.name || 'Group') : 'Direct Message'}</td>
                  <td className="p-3 text-sm">{c.members.map(id=> users.find(u=>u.id===id)?.name||id).join(', ')}</td>
                  <td className="p-3 text-sm">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {filtered.length===0 && (<tr><td className="p-6 text-sm text-muted-foreground" colSpan={3}>No conversations</td></tr>)}
            </tbody>
          </table>
        </div>
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
                {users
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
                {users.filter(u => (u.name+" "+u.email).toLowerCase().includes(memberQ.toLowerCase())).length===0 && (
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
