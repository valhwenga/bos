import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";

const InviteAccept: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      AuthStore.acceptInvite(token, name, password);
      navigate("/auth/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That invitation is no longer valid.");
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
        {!token && (
          <AuthError message="This link is missing its invitation code. Ask for a new invite." />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" autoFocus required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="mt-1 w-full" disabled={!token}>Create account</Button>
      </form>
    </AuthShell>
  );
};

export default InviteAccept;
