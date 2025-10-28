import { useState } from "react";
import { EmailStore, type MailAddress, type MailAttachment } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";

function toDataUrl(file: File): Promise<MailAttachment> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}

const Compose = () => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const smtp = EmailStore.smtp();
  const navigate = useNavigate();

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; const a = await toDataUrl(f); setAttachments((prev)=> [...prev, a]);
  };

  const parseRecipients = (s: string): MailAddress[] => s.split(/\s*,\s*/).filter(Boolean).map(email => ({ email }));

  const send = async () => {
    if (!to.trim() || !subject.trim()) return;
    const msg = await EmailStore.send({
      from: { name: smtp.fromName || undefined, email: smtp.fromEmail || smtp.username },
      to: parseRecipients(to),
      subject,
      body,
      cc: [],
      attachments,
      threadId: undefined,
      read: true,
    } as any);
    navigate(`/email/${msg.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Compose</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=> navigate(-1)}>Cancel</Button>
          <Button onClick={send} disabled={!to.trim() || !subject.trim()}>Send</Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1">
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
