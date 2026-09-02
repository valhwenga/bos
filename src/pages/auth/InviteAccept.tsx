import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";

/**
 * Finishes setting up an invited account.
 *
 * The invitation email carries the credential; opening it signs the person in
 * with a short-lived session, so this page only has to collect a name and a
 * password. The account and its role were created by an administrator through
 * the admin-create-user function, not here — the browser cannot create users.
 */
const InviteAccept: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void AuthStore.hasRecoverySession().then((ok) => {
      setReady(ok);
      if (!ok) setError("That invitation link is invalid or has expired. Ask for a new one.");
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await AuthStore.changePassword(password);
      await AuthStore.setOwnName(name);
      await AuthStore.signOut();
      navigate("/auth/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That invitation is no longer valid.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Accept your invitation"
      subtitle="Set your name and a password to finish setting up your account."
      footer={
        <>
          Already set up?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" autoFocus required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="mt-1 w-full" disabled={!ready || submitting}>
          {submitting ? "Setting up…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default InviteAccept;
