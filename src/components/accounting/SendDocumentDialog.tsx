import { useEffect, useState } from "react";
import { Send, Paperclip, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import type { Invoice, Quotation } from "@/lib/accountingStore";
import { draftDocumentEmail, sendDocument } from "@/lib/sendDocument";
import { buildDocumentPdf, documentFileName, type DocumentKind } from "@/lib/documentPdf";

/**
 * Sends a document to the customer, with the PDF attached.
 *
 * The wording is editable rather than fixed: an invoice chased for the third
 * time should not read like the first, and a covering note is often the point
 * of sending it.
 */
export function SendDocumentDialog({
  doc,
  kind,
  open,
  onOpenChange,
  onSent,
}: {
  doc?: Invoice | Quotation;
  /** Stated by the caller — the two types share statuses, so it cannot be
      inferred from the record. */
  kind: DocumentKind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;
    const draft = draftDocumentEmail(doc, kind);
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
  }, [open, doc, kind]);

  if (!doc) return null;

  const send = async () => {
    setSending(true);
    try {
      const result = await sendDocument(doc, kind, { to, subject, body });
      toast({ title: "Sent", description: `${doc.number} sent to ${result.to.join(", ")}.` });
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      // Nothing is marked as sent when this fails. The old mailto: approach
      // could not tell success from a machine with no mail client at all.
      toast({
        title: "Could not send",
        description: err instanceof Error ? err.message : "The document was not sent.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  /** Lets someone check the attachment before it goes to a customer. */
  const preview = async () => {
    try {
      const blob = await buildDocumentPdf(doc, kind);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Revoked late: revoking immediately can cancel the load in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({
        title: "Could not build the PDF",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send {doc.number}</DialogTitle>
          <DialogDescription>
            The document is attached as a PDF and sent from the company's email address.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="send-to">To</Label>
            <Input
              id="send-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.co.za"
            />
            {!to && (
              <span className="text-xs text-danger">
                This customer has no email address on file — enter one to send.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="send-subject">Subject</Label>
            <Input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="send-body">Message</Label>
            <Textarea
              id="send-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="font-mono text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => void preview()}
            className="flex items-center gap-2 self-start rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">{documentFileName(doc, kind)}</span>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Preview</span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={sending || !to || !subject}>
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
