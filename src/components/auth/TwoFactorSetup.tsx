import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { TwoFactor, type EnrollmentStart } from "@/lib/twoFactor";
import { refreshSession } from "@/lib/session";

/**
 * Sets up an authenticator app.
 *
 * Shows the QR code and the secret in text, because a QR code is useless to
 * someone setting this up on the same device they are reading it on, or using a
 * password manager rather than a phone.
 */
export function TwoFactorSetup({
  enrolled,
  onChange,
  allowRemoval = true,
}: {
  enrolled: boolean;
  onChange?: () => void;
  /** False when the role requires 2FA, so turning it off is not offered. */
  allowRemoval?: boolean;
}) {
  const [start, setStart] = useState<EnrollmentStart | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    try {
      setStart(await TwoFactor.startEnrollment());
    } catch (err) {
      toast({
        title: "Could not start setup",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!start) return;
    setBusy(true);
    try {
      await TwoFactor.confirmEnrollment(start.factorId, code);
      await refreshSession();
      setStart(null);
      setCode("");
      toast({
        title: "Two-factor authentication is on",
        description: "You will be asked for a code the next time you sign in.",
      });
      onChange?.();
    } catch (err) {
      toast({
        title: "Code not accepted",
        description: err instanceof Error ? err.message : "Try the current code.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Turn off two-factor authentication? Your account will be protected by its password alone.")) return;
    setBusy(true);
    try {
      await TwoFactor.unenroll();
      await refreshSession();
      toast({ title: "Two-factor authentication is off" });
      onChange?.();
    } catch (err) {
      toast({
        title: "Could not turn it off",
        description: err instanceof Error ? err.message : "It is unchanged.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (enrolled && !start) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success-soft px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Two-factor authentication is on</p>
          <p className="text-xs text-muted-foreground">
            You are asked for a code from your authenticator app each time you sign in.
          </p>
        </div>
        {allowRemoval && (
          <Button size="sm" variant="outline" onClick={() => void remove()} disabled={busy}>
            <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
            Turn off
          </Button>
        )}
      </div>
    );
  }

  if (!start) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised px-4 py-3">
        <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Two-factor authentication is off</p>
          <p className="text-xs text-muted-foreground">
            Add a code from an authenticator app on top of your password.
          </p>
        </div>
        <Button size="sm" onClick={() => void begin()} disabled={busy}>
          {busy ? "Starting…" : "Set up"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-raised px-4 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">Scan this with your authenticator app</p>
        <p className="text-xs text-muted-foreground">
          Google Authenticator, 1Password, Authy — any of them will do.
        </p>
      </div>

      <div
        className="mx-auto w-44 rounded-md bg-white p-2"
        // Supabase returns the QR as an SVG data URL.
        dangerouslySetInnerHTML={{ __html: `<img src="${start.qrCodeSvg}" alt="QR code for setting up two-factor authentication" style="width:100%" />` }}
      />

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Or enter this key by hand</Label>
        <code className="break-all rounded border border-border bg-surface px-2 py-1.5 font-mono text-xs">
          {start.secret}
        </code>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totp">Enter the 6-digit code it shows</Label>
        <Input
          id="totp"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void confirm()} disabled={busy || code.length < 6}>
          {busy ? "Checking…" : "Confirm"}
        </Button>
        <Button variant="outline" onClick={() => { setStart(null); setCode(""); }} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
