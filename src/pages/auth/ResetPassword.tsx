import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";

const MIN_LENGTH = 8;

/**
 * Sets a new password.
 *
 * The user arrives from the emailed link, which Supabase exchanges for a
 * short-lived recovery session before this renders — so there is no token to
 * carry in the URL, and the password is changed server-side against that
 * session rather than by writing to a local account record.
 */
const ResetPassword: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // detectSessionInUrl consumes the link's fragment on load; without a
    // recovery session there is nothing to update.
    void AuthStore.hasRecoverySession().then((ok) => {
      setReady(ok);
      if (!ok) setError("That reset link is invalid or has expired. Request a new one.");
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await AuthStore.resetPassword(password);
      // Sign out so the recovery session cannot be reused, and the new password
      // is actually exercised.
      await AuthStore.signOut();
      setDone(true);
      setTimeout(() => navigate("/auth/login"), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That reset link is no longer valid.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Taking you back to sign in…">
        <div className="flex items-start gap-3 rounded-md border border-border bg-success-soft px-3 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm text-foreground">You can now sign in with your new password.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Make it something you haven't used before."
      footer={
        <Link to="/auth/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" autoFocus required />
          <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="mt-1 w-full" disabled={!ready || submitting}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
