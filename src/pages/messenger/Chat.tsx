import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessengerStore, type ChatMessage, type Conversation } from "@/lib/messengerStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Smile, X, Quote, Check, CheckCheck, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { RolesStore } from "@/lib/rolesStore";
import { HRMStore } from "@/lib/hrmStore";

const Chat = () => {
  const { id } = useParams();
  const [c, setC] = useState<Conversation | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const users = UsersStore.list();
  const me = users[0]?.id || "me";
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({}); // userId -> last ts
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentsPreview, setAttachmentsPreview] = useState<{ id: string; name: string; type: string; size: number; dataUrl: string }[]>([]);

  const refresh = () => { if(!id) return; setC(MessengerStore.getConversation(id)); setMsgs(MessengerStore.messagesFor(id)); MessengerStore.markRead(id, me); };
  useEffect(()=>{ refresh(); }, [id]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  if (!c) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> history.back()}>Back</Button>
      <div className="mt-4">Conversation not found.</div>
    </div>
  );

  const toDataUrl = (file: File): Promise<{ id: string; name: string; type: string; size: number; dataUrl: string }> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...f]);
    const prevs = await Promise.all(f.map(toDataUrl));
    setAttachmentsPreview(prev => [...prev, ...prevs]);
  };

  const send = async () => {
    if (!text.trim()) return;
    const atts = attachmentsPreview.length ? attachmentsPreview : undefined;
    MessengerStore.sendMessage(c.id, me, text, atts, replyToId || undefined);
    setText("");
    setReplyToId(null);
    setFiles([]);
    setAttachmentsPreview([]);
    refresh();
  };

  const getInitials = (name?: string) => (name || "").split(/\s+/).slice(0,2).map(s=> s[0]).join('').toUpperCase() || "U";

  const getUserMeta = (userId: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return "Unknown";
    const role = RolesStore.get(u.roleId)?.name;
    const emp = u.email ? HRMStore.list().find(e => (e.email||'').toLowerCase() === u.email.toLowerCase()) : undefined;
    const dept = emp?.department;
    const desig = emp?.designation;
    const parts = [u.name, role, desig || dept].filter(Boolean);
    return parts.join(" • ");
  };

  const withDaySeparators = useMemo(() => {
    const arr: Array<{ type: 'sep' | 'msg'; date?: string; msg?: ChatMessage }> = [];
    let lastDay = "";
    for (const m of msgs) {
      const day = new Date(m.ts).toDateString();
      if (day !== lastDay) { arr.push({ type: 'sep', date: day }); lastDay = day; }
      arr.push({ type: 'msg', msg: m });
    }
    return arr;
  }, [msgs]);

  // Typing indicator broadcast/listen (simple local tab bus)
  useEffect(() => {
    const onTyping = (e: any) => {
      const d = e?.detail as { convId: string; userId: string };
      if (!d || d.convId !== id || d.userId === me) return;
      setTypingUsers((m) => ({ ...m, [d.userId]: Date.now() }));
    };
    const gc = setInterval(() => {
      setTypingUsers((m) => {
        const now = Date.now();
        const n: Record<string, number> = {};
        for (const [k, v] of Object.entries(m)) if (now - v < 3000) n[k] = v; // 3s window
        return n;
      });
    }, 1000);
    window.addEventListener("im:typing", onTyping as EventListener);
    return () => { window.removeEventListener("im:typing", onTyping as EventListener); clearInterval(gc); };
  }, [id, me]);

  const emitTyping = () => {
    try { window.dispatchEvent(new CustomEvent("im:typing", { detail: { convId: id, userId: me } })); } catch {}
  };

  return (
    <div className="p-0 sm:p-6 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between px-4 sm:px-0 py-3 sm:mb-2 border-b sm:border-0 bg-card/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold">
            {getInitials(c.isGroup ? c.name : users.find(u=>u.id!==me && c.members.includes(u.id))?.name)}
          </div>
          <div>
            <div className="text-base sm:text-lg font-semibold">{c.isGroup ? (c.name || 'Group') : users.find(u=>u.id!==me && c.members.includes(u.id))?.name || 'Direct Message'}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">{c.members.map(id=> users.find(u=>u.id===id)?.name||id).join(', ')}</div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={()=> history.back()}>Back</Button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e170_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
        <div className="relative p-3 sm:p-4 flex flex-col gap-2">
          {withDaySeparators.map((it, idx) => (
            it.type === 'sep' ? (
              <div key={`sep_${idx}`} className="mx-auto text-[10px] sm:text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded-full border">
                {it.date}
              </div>
            ) : (
              <div key={it.msg!.id} className={`group flex ${it.msg!.authorId===me ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-2 max-w-[80%]`}> 
                  {it.msg!.authorId!==me && (
                    <div className="h-7 w-7 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-semibold">
                      {getInitials(users.find(u=>u.id===it.msg!.authorId)?.name)}
                    </div>
                  )}
                  <div className={`${it.msg!.authorId===me ? 'bg-emerald-600 text-white' : 'bg-white text-foreground'} rounded-2xl px-3 py-2 shadow-sm border ${it.msg!.authorId===me ? 'border-emerald-700/40' : 'border-border'}`}>
                    <div className={`text-[10px] mb-1 font-medium ${it.msg!.authorId===me ? 'text-emerald-100/90' : 'text-emerald-700'}`}>{getUserMeta(it.msg!.authorId)}</div>
                    {it.msg!.replyToId && (
                      <div className={`mb-1 text-[11px] border-l-2 pl-2 ${it.msg!.authorId===me ? 'border-emerald-300/60 text-emerald-100/90' : 'border-emerald-600/40 text-emerald-700/90'}`}>
                        <Quote className="inline w-3 h-3 mr-1" />
                        {msgs.find(x=>x.id===it.msg!.replyToId)?.body?.slice(0, 120) || 'Reply'}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{it.msg!.body}</div>
                    {it.msg!.attachments && it.msg!.attachments.length>0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.msg!.attachments.map(a => (
                          a.type.startsWith('image/') ? (
                            <a key={a.id} href={a.dataUrl} target="_blank" className="block"><img src={a.dataUrl} className="h-24 w-24 object-cover rounded border" /></a>
                          ) : (
                            <a key={a.id} href={a.dataUrl} target="_blank" className="text-xs underline flex items-center gap-1"><FileIcon className="w-3 h-3" />{a.name}</a>
                          )
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[10px] mt-1 ${it.msg!.authorId===me ? 'text-emerald-100/80' : 'text-muted-foreground'}`}>
                      <span>{new Date(it.msg!.ts).toLocaleTimeString()}</span>
                      {it.msg!.authorId===me && (
                        (c.members.every(uid => (it.msg!.readBy||[]).includes(uid))) ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                  {it.msg!.authorId===me && (
                    <div className="h-7 w-7 rounded-full bg-emerald-600/20 flex items-center justify-center text-[10px] font-semibold text-emerald-700">
                      {getInitials(users.find(u=>u.id===me)?.name)}
                    </div>
                  )}
                </div>
                <button title="Reply" onClick={()=> setReplyToId(it.msg!.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground px-2">Reply</button>
              </div>
            )
          ))}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t bg-card/50 px-3 sm:px-4 py-2">
        {Object.keys(typingUsers).length>0 && (
          <div className="px-1 pb-1 text-[11px] text-muted-foreground">{Object.keys(typingUsers).map(uid => users.find(u=>u.id===uid)?.name || 'Someone').join(', ')} typing…</div>
        )}
        {replyToId && (
          <div className="mb-2 text-xs border rounded bg-background px-2 py-1 flex items-center justify-between">
            <div className="truncate flex items-center gap-1"><Quote className="w-3 h-3" /> Replying: {msgs.find(x=>x.id===replyToId)?.body?.slice(0, 120)}</div>
            <button className="p-1" onClick={()=> setReplyToId(null)} title="Cancel"><X className="w-3 h-3" /></button>
          </div>
        )}
        {attachmentsPreview.length>0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachmentsPreview.map(a => (
              a.type.startsWith('image/') ? (
                <img key={a.id} src={a.dataUrl} className="h-16 w-16 object-cover rounded border" />
              ) : (
                <span key={a.id} className="text-xs inline-flex items-center gap-1 border rounded px-2 py-1"><FileIcon className="w-3 h-3" />{a.name}</span>
              )
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded hover:bg-secondary text-muted-foreground" title="Emoji"><Smile className="w-5 h-5" /></button>
          <label className="p-2 rounded hover:bg-secondary text-muted-foreground cursor-pointer" title="Attach">
            <Paperclip className="w-5 h-5" />
            <input type="file" multiple className="hidden" onChange={onPickFiles} />
          </label>
          <Input className="flex-1" placeholder="Type a message" value={text} onChange={(e)=> { setText(e.target.value); emitTyping(); }} onKeyDown={async (e)=> { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); await send(); } }} />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
