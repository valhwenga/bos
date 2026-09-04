/**
 * The shared inbox.
 *
 * Mail arriving for the company's addresses. Everything shown here was written
 * by somebody outside the system, so the sender is presented with what the mail
 * provider made of their claim to be who they say — an address alone is not
 * evidence of anything.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Paperclip, Archive } from "lucide-react";
import { InboxStore, inboxCache, senderCheck, subscribeToInbox, type InboundEmail } from "@/lib/inboxStore";
import { useCache } from "@/lib/collectionCache";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
};

/** A small, honest indicator rather than a green tick on everything. */
export const SenderBadge = ({ email }: { email: InboundEmail }) => {
  const check = senderCheck(email);
  if (check === "passed") {
    return <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Sender checks passed" />;
  }
  if (check === "failed") {
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Sender checks failed" />;
  }
  return (
    <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sender not verified" />
  );
};

const Inbox = () => {
  const { loading, error } = useCache(inboxCache);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToInbox();
    const onFocus = () => void inboxCache.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const messages = showArchived
    ? InboxStore.list().filter((m) => m.archived)
    : InboxStore.active();
  const suspicious = InboxStore.active().filter((m) => senderCheck(m) === "failed").length;

  const columns: Column<InboundEmail>[] = [
    {
      id: "from",
      header: "From",
      sortValue: (m) => m.fromName || m.fromAddress,
      cell: (m) => (
        <span className={cn("flex items-center gap-1.5", !m.read && "font-semibold")}>
          <SenderBadge email={m} />
          <span className="truncate">{m.fromName || m.fromAddress}</span>
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      sortValue: (m) => m.subject,
      cell: (m) => (
        <span className={cn("flex items-center gap-1.5", !m.read && "font-semibold")}>
          <span className="truncate">{m.subject || "(no subject)"}</span>
          {m.attachments.length > 0 && (
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has attachments" />
          )}
        </span>
      ),
    },
    {
      id: "received",
      header: "Received",
      align: "right",
      sortValue: (m) => m.receivedAt,
      cell: (m) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatWhen(m.receivedAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={showArchived ? "Archived mail" : "Inbox"}
        description="Mail received at the company's addresses."
        breadcrumbs={[{ label: "Email", to: "/email" }, { label: showArchived ? "Archived" : "Inbox" }]}
        actions={
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
            {showArchived ? "Back to inbox" : "Archived"}
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          Could not load the inbox: {error.message}
        </div>
      )}

      {suspicious > 0 && !showArchived && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {suspicious} {suspicious === 1 ? "message failed" : "messages failed"} the sender checks. The
          address they claim to be from is probably not where they came from — treat any request in them
          with suspicion.
        </div>
      )}

      <DataTable
        rows={messages}
        columns={columns}
        rowKey={(m) => m.id}
        onRowClick={(m) => navigate(`/email/inbox/${m.id}`)}
        searchAccessor={(m) => `${m.fromAddress} ${m.fromName ?? ""} ${m.subject} ${m.body}`}
        searchPlaceholder="Search by sender, subject or contents…"
        empty={{
          title: loading ? "Loading…" : showArchived ? "Nothing archived" : "No mail yet",
          description: loading
            ? "Reading the mailbox."
            : showArchived
              ? "Messages you archive are kept here."
              : "Mail sent to the company's addresses appears here once inbound delivery is configured. See DEPLOYMENT.md.",
        }}
      />
    </div>
  );
};

export default Inbox;
