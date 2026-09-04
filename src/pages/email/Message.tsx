import { useNavigate, useParams } from "react-router-dom";
import { Paperclip, AlertTriangle } from "lucide-react";
import { EmailStore, sentMailCache } from "@/lib/emailStore";
import { useCache } from "@/lib/collectionCache";
import { Button } from "@/components/ui/button";

const Message = () => {
  const { id } = useParams();
  const { loading } = useCache(sentMailCache);
  const navigate = useNavigate();
  const m = id ? EmailStore.get(id) : undefined;

  if (!m) {
    return (
      <div className="p-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        <div className="mt-4 text-muted-foreground">{loading ? "Loading…" : "Message not found."}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{m.subject || "(no subject)"}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            To {m.to.map((a) => a.name || a.email).join(", ") || "—"}
            {m.sentByName ? ` • sent by ${m.sentByName}` : ""}
            {" • "}
            {new Date(m.date).toLocaleString()}
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
      </div>

      {m.status === "failed" && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            This message was not delivered.
          </span>
          {m.error && <p className="mt-1 font-mono text-xs">{m.error}</p>}
        </div>
      )}

      {/*
        Rendered as text, not HTML. The body used to go through
        dangerouslySetInnerHTML; now that it is stored on the server and
        readable by everyone with email access, anything a colleague typed
        would have run in the reader's browser. The send function sends plain
        text anyway — its own comment says "no HTML means nothing to sanitise".
      */}
      <div className="whitespace-pre-wrap rounded border bg-background p-4 text-sm">{m.body}</div>

      {m.attachmentNames.length > 0 && (
        <div className="rounded border p-4">
          <h4 className="mb-2 font-semibold">Attachments</h4>
          <div className="flex flex-wrap gap-2">
            {m.attachmentNames.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {name}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Names are recorded, not the files. An emailed invoice or quotation can be regenerated from the
            document itself.
          </p>
        </div>
      )}
    </div>
  );
};

export default Message;
