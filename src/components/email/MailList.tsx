import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, PenSquare } from "lucide-react";
import { EmailStore, type MailMessage } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
};

const addressLabel = (a: { name?: string; email: string }) => a.name || a.email;

interface MailListProps {
  folder: "inbox" | "sent";
  title: string;
  description: string;
  /** Inbox shows who sent it; Sent shows who it went to. */
  peopleHeader: string;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Inbox and Sent differ only in which folder they read and whether the people
 * column shows sender or recipients, so they share one implementation.
 */
export const MailList = ({
  folder,
  title,
  description,
  peopleHeader,
  emptyTitle,
  emptyDescription,
}: MailListProps) => {
  const [messages, setMessages] = useState<MailMessage[]>(() => EmailStore.byFolder(folder));
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => setMessages(EmailStore.byFolder(folder));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("mail-changed", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mail-changed", refresh as EventListener);
    };
  }, [folder]);

  const people = (m: MailMessage) =>
    folder === "inbox" ? addressLabel(m.from) : m.to.map(addressLabel).join(", ");

  // Newest first, which is what every mail client does and this did not.
  const ordered = useMemo(
    () => [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [messages],
  );

  const unread = ordered.filter((m) => m.read === false).length;

  const columns: Column<MailMessage>[] = [
    {
      id: "people",
      header: peopleHeader,
      width: "22%",
      sortValue: people,
      cell: (m) => (
        <span className={cn("block truncate", m.read === false ? "font-semibold text-foreground" : "text-foreground")}>
          {people(m) || "—"}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      sortValue: (m) => m.subject,
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-2">
          {m.read === false && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          <span className={cn("truncate", m.read === false && "font-semibold")}>{m.subject || "(no subject)"}</span>
          {!!m.attachments?.length && (
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has attachments" />
          )}
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            — {m.body.replace(/<[^>]*>/g, " ").slice(0, 80)}
          </span>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      align: "right",
      width: "1%",
      sortValue: (m) => m.date,
      cell: (m) => <span className="whitespace-nowrap text-muted-foreground">{formatWhen(m.date)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={title}
        description={unread ? `${description} · ${unread} unread` : description}
        breadcrumbs={[{ label: "Email", to: "/email" }, { label: title }]}
        actions={
          <Button onClick={() => navigate("/email/compose")}>
            <PenSquare className="mr-2 h-4 w-4" aria-hidden="true" />
            Compose
          </Button>
        }
      />

      <DataTable
        rows={ordered}
        columns={columns}
        rowKey={(m) => m.id}
        searchAccessor={(m) => `${m.subject} ${m.body} ${people(m)}`}
        searchPlaceholder="Search mail…"
        onRowClick={(m) => navigate(`/email/${m.id}`)}
        pageSize={30}
        empty={{
          title: emptyTitle,
          description: emptyDescription,
          action: <Button onClick={() => navigate("/email/compose")}>Compose</Button>,
        }}
      />
    </div>
  );
};
