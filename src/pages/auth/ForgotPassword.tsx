import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";
import { toast } from "@/components/ui/use-toast";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setToken(AuthStore.requestPasswordReset(email).token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't start a reset for that address.");
    }
  };

  const resetLink = token ? `${window.location.origin}/auth/reset?token=${token}` : "";

  if (token) {
    return (
      <AuthShell
        title="Reset link ready"
        subtitle="There's no mail server configured yet, so the link is shown here."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reset link</span>
            <code className="break-all font-mono text-xs text-foreground">{resetLink}</code>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to={`/auth/reset?token=${token}`}>Open reset page</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard?.writeText(resetLink);
                toast({ title: "Link copied" });
              }}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy link
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll start a reset."
      footer={
        <Link to="/auth/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" autoFocus required />
        </div>
        <Button type="submit" className="mt-1 w-full">Send reset link</Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
