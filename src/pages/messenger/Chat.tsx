import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MessengerStore,
  conversationsCache,
  messagesCache,
  subscribeToMessages,
  type ChatMessage,
} from "@/lib/messengerStore";
import { useAccounts } from "@/lib/useAccounts";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Smile, X, Quote, Check, CheckCheck, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { useCache } from "@/lib/collectionCache";
import { RolesStore, rolesCache } from "@/lib/rolesStore";
import { HRMStore } from "@/lib/hrmStore";

const Chat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  useCache(rolesCache);
  const users = useAccounts();
  const me = AuthStore.currentUser()?.id ?? "";
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({}); // userId -> last ts
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  useCache(conversationsCache);
  // A cache per conversation, so switching threads subscribes to the new one.
  // `id` is always present on this route; the fallback keeps the hook order
  // fixed rather than making the subscription conditional.
  useCache(useMemo(() => messagesCache(id ?? "none"), [id]));

  const c = id ? MessengerStore.getConversation(id) : undefined;
  const msgs = id ? MessengerStore.messagesFor(id) : [];

  useEffect(() => {
    if (!id) return;
    void MessengerStore.markRead(id);
    // Replies arrive while you are reading. The focus refresh covers a
    // websocket that has quietly dropped.
    const unsubscribe = subscribeToMessages(id, () => void MessengerStore.markRead(id));
    const onFocus = () => void messagesCache(id).refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [id]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    // The files themselves go to storage on send. They used to be read into
    // base64 data URLs and carried on the message row, inside the same 5MB
    // origin quota as the rest of the app.
    setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
  };

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const send = async () => {
    if (!c || (!text.trim() && files.length === 0) || sending) return;
    setSending(true);
    setSendError("");
    try {
      await MessengerStore.sendMessage(
        c.id,
        text,
        files.length ? files : undefined,
        replyToId || undefined,
        users.find(u => u.id === me)?.name,
      );
      setText("");
      setReplyToId(null);
      setFiles([]);
    } catch (err: unknown) {
      // The message did not send. Saying so beats clearing the box and
      // leaving the person to find out later that nobody replied.
      setSendError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name?: string) => (name || "").split(/\s+/).slice(0,2).map(s=> s[0]).join('').toUpperCase() || "U";

  const getUserMeta = (userId: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return "Unknown";
    const role = u.roleId ? RolesStore.get(u.roleId)?.name : undefined;
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
    const onTyping = (e: Event) => {
      const d = (e as CustomEvent<unknown>)?.detail as { convId: string; userId: string } | undefined;
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
    try { window.dispatchEvent(new CustomEvent("im:typing", { detail: { convId: id, userId: me } })); } catch { void 0; }
  };

  if (!c) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Conversation not found.</div>
    </div>
  );

  return (
    <div className="p-0 sm:p-6 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between px-4 sm:px-0 py-3 sm:mb-2 border-b sm:border-0 bg-card/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
            {getInitials(c.isGroup ? c.name : users.find(u=>u.id!==me && c.members.includes(u.id))?.name)}
          </div>
          <div>
            <div className="text-base sm:text-lg font-semibold">{c.isGroup ? (c.name || 'Group') : users.find(u=>u.id!==me && c.members.includes(u.id))?.name || 'Direct Message'}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">{c.members.map(id=> users.find(u=>u.id===id)?.name||id).join(', ')}</div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={()=> navigate(-1)}>Back</Button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
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
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                      {getInitials(users.find(u=>u.id===it.msg!.authorId)?.name)}
                    </div>
                  )}
                  <div className={`${it.msg!.authorId===me ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'} rounded-2xl px-3 py-2 shadow-sm border ${it.msg!.authorId===me ? 'border-primary/40' : 'border-border'}`}>
                    <div className={`text-[10px] mb-1 font-medium ${it.msg!.authorId===me ? 'text-primary-foreground/90' : 'text-primary'}`}>{getUserMeta(it.msg!.authorId)}</div>
                    {it.msg!.replyToId && (
                      <div className={`mb-1 text-[11px] border-l-2 pl-2 ${it.msg!.authorId===me ? 'border-primary-foreground/50 text-primary-foreground/90' : 'border-primary/40 text-primary/90'}`}>
                        <Quote className="inline w-3 h-3 mr-1" />
                        {msgs.find(x=>x.id===it.msg!.replyToId)?.body?.slice(0, 120) || 'Reply'}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{it.msg!.body}</div>
                    {it.msg!.attachments && it.msg!.attachments.length>0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.msg!.attachments.map(a => (
                          a.type.startsWith('image/') && a.url ? (
                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block"><img src={a.url} alt={a.name} className="h-24 w-24 object-cover rounded border" /></a>
                          ) : (
                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs underline flex items-center gap-1"><FileIcon className="w-3 h-3" />{a.name}</a>
                          )
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[10px] mt-1 ${it.msg!.authorId===me ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      <span>{new Date(it.msg!.ts).toLocaleTimeString()}</span>
                      {it.msg!.authorId===me && (
                        (c.members.every(uid => uid === me || (c.readAt[uid] ?? "") >= it.msg!.ts)) ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                  {it.msg!.authorId===me && (
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
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
        {files.length>0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="text-xs inline-flex items-center gap-1 border rounded px-2 py-1">
                <FileIcon className="w-3 h-3" />{f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={()=> setFiles(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {sendError && <p className="mb-2 text-sm text-danger">{sendError}</p>}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded hover:bg-secondary text-muted-foreground" title="Emoji"><Smile className="w-5 h-5" /></button>
          <label className="p-2 rounded hover:bg-secondary text-muted-foreground cursor-pointer" title="Attach">
            <Paperclip className="w-5 h-5" />
            <input type="file" multiple className="hidden" onChange={onPickFiles} />
          </label>
          <Input className="flex-1" placeholder="Type a message" value={text} onChange={(e)=> { setText(e.target.value); emitTyping(); }} onKeyDown={async (e)=> { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); await send(); } }} />
          <Button onClick={()=> void send()} disabled={sending}>{sending ? "Sending…" : "Send"}</Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
