/**
 * A received email.
 *
 * Rendered as text throughout. The body was written by a stranger, and the
 * inbound function stores only the plain text part for that reason — there is
 * no version of rendering attacker-authored markup that is worth the risk in a
 * mailbox nobody needs rich text in.
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Paperclip, Archive, ArchiveRestore, Reply, ShieldAlert, LifeBuoy } from "lucide-react";
import { InboxStore, inboxCache, senderCheck } from "@/lib/inboxStore";
import { useCache } from "@/lib/collectionCache";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { SenderBadge } from "./Inbox";

const InboundMessage = () => {
  const { id } = useParams();
  const { loading } = useCache(inboxCache);
  const navigate = useNavigate();
  const m = id ? InboxStore.get(id) : undefined;

  useEffect(() => {
    if (m && !m.read) void InboxStore.markRead(m.id);
  }, [m]);

  if (!m) {
    return (
      <div className="p-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        <div className="mt-4 text-muted-foreground">{loading ? "Loading…" : "Message not found."}</div>
      </div>
    );
  }

  const check = senderCheck(m);

  const archive = async () => {
    try {
      await InboxStore.setArchived(m.id, !m.archived);
      toast({ title: m.archived ? "Moved back to the inbox" : "Archived" });
      if (!m.archived) navigate("/email/inbox");
    } catch (err: unknown) {
      toast({
        title: "Could not archive",
        description: err instanceof Error ? err.message : "The server refused.",
        variant: "destructive",
      });
    }
  };

  /** Pre-fills a reply. Sending goes out through the ordinary send path. */
  const reply = () => {
    const params = new URLSearchParams({
      to: m.fromAddress,
      subject: m.subject.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject}`,
      body: `\n\n---\nOn ${new Date(m.receivedAt).toLocaleString()}, ${m.fromName || m.fromAddress} wrote:\n${m.body
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`,
    });
    navigate(`/email/compose?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{m.subject || "(no subject)"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <SenderBadge email={m} />
            <span className="font-medium text-foreground">{m.fromName || m.fromAddress}</span>
            {m.fromName && <span>&lt;{m.fromAddress}&gt;</span>}
            <span>•</span>
            <span>{new Date(m.receivedAt).toLocaleString()}</span>
          </div>
          {m.to.length > 0 && (
            <div className="mt-0.5 text-xs text-muted-foreground">To {m.to.join(", ")}</div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="outline" onClick={() => void archive()}>
            {m.archived ? (
              <><ArchiveRestore className="mr-2 h-4 w-4" aria-hidden="true" />Unarchive</>
            ) : (
              <><Archive className="mr-2 h-4 w-4" aria-hidden="true" />Archive</>
            )}
          </Button>
          {!m.ticket && (
            <Button onClick={reply}>
              <Reply className="mr-2 h-4 w-4" aria-hidden="true" />
              Reply
            </Button>
          )}
        </div>
      </div>

      {m.ticket && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-info/40 bg-info-soft px-4 py-3 text-sm text-info">
          <span className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
            This opened ticket {m.ticket.reference}. Answer it there so the reply reaches the customer
            and the ticket records it.
          </span>
          <Button size="sm" variant="outline" onClick={() => navigate(`/support/tickets/${m.ticket!.id}`)}>
            Open ticket
          </Button>
        </div>
      )}

      {check === "failed" && (
        <div className="flex gap-2 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">This message failed its sender checks.</p>
            <p className="mt-0.5">
              It did not come from where it claims to. Do not act on a request in it — a change of bank
              details especially — without confirming by some other means.
            </p>
            <p className="mt-1 font-mono text-xs">
              SPF {m.spf || "none"} · DKIM {m.dkim || "none"}
            </p>
          </div>
        </div>
      )}

      {check === "unchecked" && (
        <div className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          The sender was not verified. That is common for legitimate mail, but it is not proof of who
          sent this.
        </div>
      )}

      <div className="whitespace-pre-wrap rounded border bg-background p-4 text-sm">{m.body}</div>

      {m.attachments.length > 0 && (
        <div className="rounded border p-4">
          <h4 className="mb-2 font-semibold">Attachments</h4>
          <div className="flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                download={a.name}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs underline"
              >
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {a.name}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Files from outside. Open them with the same care you would give an attachment in any other
            mailbox.
          </p>
        </div>
      )}
    </div>
  );
};

export default InboundMessage;
