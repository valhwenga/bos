import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TwoFactor } from "@/lib/twoFactor";
import { AuthStore } from "@/lib/authStore";
import { refreshSession } from "@/lib/session";
import { safeReturnPath } from "./Login";

/**
 * Asks for the code after a password sign-in.
 *
 * Until this succeeds the session is aal1 — authenticated, but not to the level
 * the account requires — and the route guard keeps sending the user back here.
 */
const TwoFactorChallenge: React.FC = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await TwoFactor.verifyCode(code);
      // The assurance level changed, so the session snapshot is now stale.
      await refreshSession();
      navigate(safeReturnPath(location.state?.from), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code was not accepted.");
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    // Leaving a half-authenticated session lying around is worse than ending
    // it: the password has already been accepted.
    await AuthStore.signOut();
    navigate("/auth/login", { replace: true });
  };

  return (
    <AuthShell
      title="Enter your code"
      subtitle="Open your authenticator app and enter the current 6-digit code."
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />

        <div className="flex items-start gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Codes change every 30 seconds. If yours keeps failing, check your phone's clock is set
            automatically.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Authentication code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            autoFocus
            required
          />
        </div>

        <Button type="submit" className="mt-1 w-full" disabled={submitting || code.length < 6}>
          {submitting ? "Checking…" : "Verify"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void cancel()}>
          Cancel and sign out
        </Button>
      </form>
    </AuthShell>
  );
};

export default TwoFactorChallenge;
