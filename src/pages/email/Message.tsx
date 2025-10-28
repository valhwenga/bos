import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmailStore, type MailMessage } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";

const Message = () => {
  const { id } = useParams();
  const [m, setM] = useState<MailMessage | undefined>(undefined);
  const navigate = useNavigate();
  useEffect(()=>{ setM(id ? EmailStore.get(id) : undefined); }, [id]);
  if (!m) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Message not found.</div>
    </div>
  );
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m.subject}</h1>
          <div className="text-sm text-muted-foreground">From {m.from.name || m.from.email} • {new Date(m.date).toLocaleString()}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
          <Button onClick={()=> navigate(`/email/compose?reply=${m.id}`)}>Reply</Button>
        </div>
      </div>
      <div className="rounded border p-4 bg-background" dangerouslySetInnerHTML={{ __html: m.body.replace(/\n/g,'<br/>') }} />
      {m.attachments && m.attachments.length>0 && (
        <div className="rounded border p-4">
          <h4 className="font-semibold mb-2">Attachments</h4>
          <div className="flex flex-wrap gap-2">
            {m.attachments.map(a => (
              <a key={a.id} href={a.dataUrl} target="_blank" className="text-xs underline">{a.name}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;
