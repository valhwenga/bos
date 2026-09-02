import React, { useState } from "react";
import { Link, useLocation, useNavigate, type Location } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";

interface LoginLocationState {
  from?: string;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as Location<LoginLocationState>;
  // Explains an automatic sign-out, so a timed-out session does not look like
  // the app simply threw the user back to the login page.
  const timedOut = new URLSearchParams(location.search).get("reason") === "timeout";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await AuthStore.signIn(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't sign you in. Check your details and try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Enter your work email and password to continue."
      footer={
        <>
          No account?{" "}
          <Link to="/auth/signup" className="font-medium text-primary hover:underline">
            Request access
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />

        {timedOut && !error && (
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-foreground">
            You were signed out because the session was idle. Sign in to continue.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/forgot" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="mt-1 w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default Login;
