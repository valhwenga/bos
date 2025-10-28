import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomersStore } from "@/lib/customersStore";
import { WhatsAppSettingsStore } from "@/lib/whatsappSettings";
import { WhatsAppStore, WaThread, WaMessage } from "@/lib/whatsappStore";
import { AuthStore } from "@/lib/authStore";

const nameForPhone = (phone: string) => {
  const c = CustomersStore.list().find(x => x.phone && WhatsAppStore.normalizePhone(x.phone) === WhatsAppStore.normalizePhone(phone));
  return c?.name || phone;
};

const WaConsole: React.FC = () => {
  const [threads, setThreads] = useState<WaThread[]>(WhatsAppStore.listThreads());
  const [messages, setMessages] = useState<WaMessage[]>(WhatsAppStore.listMessages());
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | undefined>(threads[0]?.id);
  const [compose, setCompose] = useState("");
  const s = WhatsAppSettingsStore.get();
  const me = AuthStore.currentUser();

  useEffect(() => {
    const onChange = () => { setThreads(WhatsAppStore.listThreads()); setMessages(WhatsAppStore.listMessages()); };
    window.addEventListener('wa.messages-changed', onChange as any);
    // Poll inbound from serverless if available
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/wa-pull', { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        const events: { from: string; body: string; ts?: string }[] = data?.events || [];
        for (const e of events) {
          const phone = WhatsAppStore.normalizePhone(e.from);
          WhatsAppStore.addMessage({ id: `wam_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, threadId: phone, phone, from: 'customer', body: e.body || '', ts: e.ts || new Date().toISOString() });
        }
      } catch {}
    }, 5000);
    return () => { window.removeEventListener('wa.messages-changed', onChange as any); clearInterval(iv); };
  }, []);

  const filteredThreads = useMemo(() => {
    const L = q.toLowerCase();
    return threads
      .slice()
      .sort((a,b)=> (b.lastTs||'').localeCompare(a.lastTs||''))
      .filter(t => nameForPhone(t.phone).toLowerCase().includes(L) || t.phone.includes(q));
  }, [threads, q]);

  const msgsForActive = useMemo(() => messages.filter(m => m.threadId===active).sort((a,b)=> (a.ts||'').localeCompare(b.ts||'')), [messages, active]);

  const send = async () => {
    const thread = threads.find(t=> t.id===active);
    if (!thread) return;
    if (!compose.trim()) return;
    const out: WaMessage = { id: `wam_${Date.now()}`, threadId: thread.id, phone: thread.phone, from: 'me', body: compose, ts: new Date().toISOString(), status: 'sent' };
    WhatsAppStore.addMessage(out);
    setCompose("");
    // Real send if configured
    try {
      const c = CustomersStore.list().find(x => x.id===thread.customerId) || CustomersStore.list().find(x=> x.phone && WhatsAppStore.normalizePhone(x.phone)===thread.phone);
      const toPhone = c?.phone || thread.phone;
      if (!s.accessToken || !s.phoneNumberId) throw new Error('Missing settings, simulating');
      const url = `https://graph.facebook.com/v20.0/${s.phoneNumberId}/messages`;
      const payload = { messaging_product: "whatsapp", to: toPhone, type: "text", text: { body: out.body } } as any;
      const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${s.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
    } catch { /* simulated */ }
  };

  const createThreadForCustomer = () => {
    // Quick start a thread by picking a customer
    const cs = CustomersStore.list();
    const withPhone = cs.filter(c=> !!c.phone);
    if (withPhone.length===0) { alert('No customers with phone'); return; }
    const c = withPhone[0];
    const phone = WhatsAppStore.normalizePhone(c.phone!);
    WhatsAppStore.upsertThread({ id: phone, phone, customerId: c.id, unread: 0 });
    setActive(phone);
  };

  const assignToMe = () => { if (active && me) WhatsAppStore.assign(active, me.id); };
  const markRead = () => { if (active) WhatsAppStore.markRead(active); };
  const linkFirstCustomer = () => {
    if (!active) return;
    const cs = CustomersStore.list();
    const c = cs.find(x => x.phone && WhatsAppStore.normalizePhone(x.phone)===active);
    if (c) WhatsAppStore.linkCustomer(active, c.id);
  };
  const injectInbound = () => { if (active) WhatsAppStore.simulateInbound(active, 'Test inbound message'); };

  return (
    <div className="p-6">
      <Card>
        <CardHeader><CardTitle>WhatsApp Shared Inbox</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-3 h-[70vh]">
            {/* Threads */}
            <div className="col-span-3 border rounded-lg flex flex-col">
              <div className="p-2"><Input placeholder="Search name or phone" value={q} onChange={(e)=> setQ(e.target.value)} /></div>
              <div className="px-2"><Button size="sm" variant="secondary" onClick={createThreadForCustomer}>New thread from customer</Button></div>
              <div className="flex-1 overflow-auto p-2 space-y-1">
                {filteredThreads.map(t => (
                  <button key={t.id} onClick={()=> { setActive(t.id); WhatsAppStore.markRead(t.id); }} className={`w-full text-left p-2 rounded border ${active===t.id?'bg-secondary':''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{nameForPhone(t.phone)}</span>
                      {t.unread ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">{t.unread}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{t.lastSnippet}</div>
                  </button>
                ))}
                {filteredThreads.length===0 && <div className="text-xs text-muted-foreground">No threads</div>}
              </div>
            </div>

            {/* Messages */}
            <div className="col-span-6 border rounded-lg flex flex-col">
              <div className="p-2 border-b flex items-center gap-2">
                <div className="font-medium">{active ? nameForPhone(active) : 'Select a thread'}</div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={markRead} disabled={!active}>Mark read</Button>
                  <Button size="sm" variant="secondary" onClick={injectInbound} disabled={!active}>Inject inbound</Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {msgsForActive.map(m => (
                  <div key={m.id} className={`max-w-[75%] p-2 rounded ${m.from==='me'?'bg-primary text-primary-foreground ml-auto':'bg-secondary'}`}>
                    <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                    <div className="text-[10px] opacity-70 mt-1">{new Date(m.ts).toLocaleString()}</div>
                  </div>
                ))}
                {active && msgsForActive.length===0 && <div className="text-xs text-muted-foreground">No messages yet.</div>}
                {!active && <div className="text-xs text-muted-foreground">Pick a thread to start.</div>}
              </div>
              <div className="p-2 border-t flex gap-2">
                <Textarea rows={2} className="flex-1" placeholder="Type a message" value={compose} onChange={(e)=> setCompose(e.target.value)} />
                <Button onClick={send} disabled={!active || !compose.trim()}>Send</Button>
              </div>
            </div>

            {/* Side panel */}
            <div className="col-span-3 border rounded-lg p-3 space-y-2">
              {active ? (
                <>
                  <div className="text-sm font-medium">Thread</div>
                  <div className="text-xs text-muted-foreground">{active}</div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={assignToMe} disabled={!me}>Assign to me</Button>
                    <Button size="sm" variant="secondary" onClick={linkFirstCustomer}>Link customer</Button>
                  </div>
                  {!s.accessToken || !s.phoneNumberId ? (
                    <div className="text-[11px] text-amber-600">No WhatsApp credentials; sends are simulated.</div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Select a thread to view details.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaConsole;
