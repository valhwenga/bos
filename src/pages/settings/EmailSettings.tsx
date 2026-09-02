import { Mail, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Email is configured on the server, not here.
 *
 * This page used to collect SMTP host, username and password and keep them in
 * localStorage — in plain text, readable by anything running in the page, and
 * different on every machine. It also did nothing: nothing ever read those
 * settings to send a message, because sending was a `mailto:` link.
 *
 * The credentials now live as secrets on the send-email edge function, where
 * the browser never sees them. Removing the form rather than leaving it is the
 * point: a settings screen that appears to configure something it does not is
 * how the SMTP password ended up in localStorage in the first place.
 */
const EmailSettings = () => (
  <div className="flex flex-col gap-6 p-6">
    <PageHeader
      title="Email"
      description="How documents and notifications are sent."
      breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "Email" }]}
    />

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Sending is configured on the server
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <p>
          Invoices, quotations and notifications are sent by the{" "}
          <code className="rounded bg-surface-raised px-1 py-0.5 text-xs">send-email</code>{" "}
          function using the company's mail account. There is nothing to set up per machine, and
          everyone sends from the same address.
        </p>

        <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-medium text-foreground">Why this is not a form</p>
            <p className="mt-1">
              A mail password entered here would be stored in this browser, in plain text, where
              any script on the page could read it — and it would differ from machine to machine.
              It belongs on the server.
            </p>
          </div>
        </div>

        <div>
          <p className="font-medium text-foreground">To change the mail account</p>
          <p className="mt-1">
            Set these as function secrets on the Supabase project, then redeploy the function:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
            <li>SMTP_HOST</li>
            <li>SMTP_PORT — 465 for TLS, or 587</li>
            <li>SMTP_USER and SMTP_PASSWORD — omit both for a relay that needs no login</li>
            <li>SMTP_FROM and SMTP_FROM_NAME — the address customers will see</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default EmailSettings;
