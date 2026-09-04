import { useNavigate } from "react-router-dom";
import { Paperclip, PenSquare, AlertTriangle } from "lucide-react";
import { EmailStore, sentMailCache, type MailMessage } from "@/lib/emailStore";
import { useCache } from "@/lib/collectionCache";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
};

/**
 * What the company has sent.
 *
 * This used to render either an inbox or a sent folder from the same
 * localStorage array. The inbox is gone — nothing could ever arrive in it —
 * and the sent list is a shared server record now, so it shows who sent each
 * message rather than assuming it was you.
 */
export const MailList = () => {
  const { loading, error } = useCache(sentMailCache);
  const messages = EmailStore.list();
  const navigate = useNavigate();

  const failed = messages.filter((m) => m.status === "failed").length;

  const columns: Column<MailMessage>[] = [
    {
      id: "to",
      header: "To",
      sortValue: (m) => m.to.map((a) => a.email).join(", "),
      cell: (m) => (
        <span className="font-medium">
          {m.to.map((a) => a.name || a.email).join(", ") || "—"}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      sortValue: (m) => m.subject,
      cell: (m) => (
        <span className="flex items-center gap-1.5">
          {m.status === "failed" && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Not delivered" />
          )}
          <span className="truncate">{m.subject || "(no subject)"}</span>
          {m.attachmentNames.length > 0 && (
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has attachments" />
          )}
        </span>
      ),
    },
    {
      id: "sentBy",
      header: "Sent by",
      hideOnMobile: true,
      sortValue: (m) => m.sentByName ?? "",
      cell: (m) => <span className="text-muted-foreground">{m.sentByName || "System"}</span>,
    },
    {
      id: "date",
      header: "When",
      align: "right",
      sortValue: (m) => m.date,
      cell: (m) => <span className="whitespace-nowrap text-muted-foreground">{formatWhen(m.date)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Sent mail"
        description="Everything the system has emailed out, including invoices and quotations."
        breadcrumbs={[{ label: "Email", to: "/email" }, { label: "Sent" }]}
        actions={
          <Button onClick={() => navigate("/email/compose")}>
            <PenSquare className="mr-2 h-4 w-4" aria-hidden="true" />
            Compose
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          Could not load sent mail: {error.message}
        </div>
      )}

      {failed > 0 && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {failed} {failed === 1 ? "message was" : "messages were"} refused by the mail server. Open one to
          see why.
        </div>
      )}

      <DataTable
        rows={messages}
        columns={columns}
        rowKey={(m) => m.id}
        onRowClick={(m) => navigate(`/email/${m.id}`)}
        searchAccessor={(m) => `${m.subject} ${m.to.map((a) => a.email).join(" ")} ${m.sentByName ?? ""}`}
        searchPlaceholder="Search by recipient, subject or sender…"
        empty={{
          title: loading ? "Loading…" : "Nothing sent yet",
          description: loading
            ? "Reading the log."
            : "Messages you send — including emailed invoices — will be listed here.",
        }}
      />
    </div>
  );
};
