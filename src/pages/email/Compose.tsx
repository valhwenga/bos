import { useState } from "react";
import { sendEmail } from "@/lib/sendDocument";
import { toast } from "@/components/ui/use-toast";
import { EmailStore, sentMailCache, type MailAddress, type MailAttachment } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SendIdentities, sendIdentitiesCache } from "@/lib/sendIdentities";
import { useCache } from "@/lib/collectionCache";

function toDataUrl(file: File): Promise<MailAttachment> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}

/** Radix reserves "" to mean "no selection", so a sentinel is needed instead. */
const DEFAULT_IDENTITY = "__default__";

const Compose = () => {
  // Pre-filled when replying from the inbox. Read once as the initial state
  // rather than synced, so typing is not fighting the query string.
  const [params] = useSearchParams();
  const [to, setTo] = useState(() => params.get("to") ?? "");
  const [subject, setSubject] = useState(() => params.get("subject") ?? "");
  const [body, setBody] = useState(() => params.get("body") ?? "");
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  useCache(sendIdentitiesCache);
  const identities = SendIdentities.usable();
  // Empty means the server's default, which is right when none are configured
  // and is also a legitimate choice when they are.
  const [fromIdentity, setFromIdentity] = useState("");
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; const a = await toDataUrl(f); setAttachments((prev)=> [...prev, a]);
  };

  const parseRecipients = (s: string): MailAddress[] => s.split(/\s*,\s*/).filter(Boolean).map(email => ({ email }));

  const send = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);

    // Actually send it. This previously only wrote a record into the local
    // "Sent" folder, so a message appeared to have gone and never left the
    // browser.
    try {
      await sendEmail({
        to: parseRecipients(to).map((r) => r.email),
        subject,
        body,
        module: "email",
        fromIdentity: fromIdentity || undefined,
        attachments: attachments
          .filter((a) => a.dataUrl?.includes(","))
          .map((a) => ({
            filename: a.name,
            contentBase64: a.dataUrl.split(",")[1],
            contentType: a.type || undefined,
          })),
      });
    } catch (err) {
      toast({
        title: "Could not send",
        description: err instanceof Error ? err.message : "The message was not sent.",
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    // The send-email function records the message as it sends it, so there is
    // nothing to write here — only the list to refresh.
    await EmailStore.load();
    void sentMailCache.refresh();
    setSending(false);
    navigate("/email/sent");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Compose</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=> navigate(-1)}>Cancel</Button>
          <Button onClick={() => void send()} disabled={sending || !to.trim() || !subject.trim()}>{sending ? "Sending…" : "Send"}</Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1">
          {identities.length > 0 && (
            <>
              <label className="text-xs text-muted-foreground">From</label>
              <Select value={fromIdentity || DEFAULT_IDENTITY} onValueChange={(v) => setFromIdentity(v === DEFAULT_IDENTITY ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_IDENTITY}>The system default address</SelectItem>
                  {identities.map((i) => (
                    <SelectItem key={i.id} value={i.address}>
                      {i.displayName ? `${i.displayName} <${i.address}>` : i.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <label className="text-xs text-muted-foreground">To</label>
          <Input placeholder="email@example.com, other@example.com" value={to} onChange={(e)=> setTo(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Subject</label>
          <Input value={subject} onChange={(e)=> setSubject(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Body</label>
          <Textarea className="min-h-[300px]" value={body} onChange={(e)=> setBody(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Attachments</label>
          <Input type="file" onChange={onAttach} />
          <div className="flex flex-wrap gap-2 mt-1">
            {attachments.map(a => <span key={a.id} className="text-xs border rounded px-2 py-1">{a.name}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compose;
