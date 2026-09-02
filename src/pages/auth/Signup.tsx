import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";

const Signup: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await AuthStore.signUpRequest(name, email, password);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't submit your request. Try again.");
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Check your email" subtitle="Two things happen before you can sign in.">
        <div className="flex flex-col gap-4">
          {/* There are two gates now — confirming the address, then an
              administrator approving the account. Mentioning only the second
              would leave people waiting on an approval that cannot happen
              until they click the link. */}
          <div className="flex items-start gap-3 rounded-md border border-border bg-success-soft px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <div className="text-sm text-foreground">
              <p>
                We've sent a confirmation link to{" "}
                <span className="font-medium">{email}</span>.
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Open the link to confirm the address is yours.</li>
                <li>An administrator then approves the account and sets your role.</li>
              </ol>
              <p className="mt-2 text-muted-foreground">
                Check your spam folder if the email hasn't arrived.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Request access"
      subtitle="Tell us who you are and an administrator will set up your account."
      footer={
        <>
          Already have an account?{" "}
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
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Choose a password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>

        <Button type="submit" className="mt-1 w-full">Request access</Button>
      </form>
    </AuthShell>
  );
};

export default Signup;
