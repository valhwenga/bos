import React, { useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams, useNavigate, Link } from "react-router-dom";

const InviteAccept: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const nav = useNavigate();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      AuthStore.acceptInvite(token, name, password);
      nav('/auth/login');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] flex items-center justify-center p-6">
      <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-2xl font-semibold text-slate-900">Accept Invitation</div>
          <div className="text-slate-500 mt-1">Create your account</div>
        </div>
        <form onSubmit={onSubmit} className="p-6 pt-0 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Full name</div>
            <Input value={name} onChange={e=> setName(e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Password</div>
            <Input value={password} onChange={e=> setPassword(e.target.value)} type="password" placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full">Create Account</Button>
          <div className="text-center text-sm text-slate-600">Have an account? <Link to="/auth/login" className="text-[#5F33FF] hover:underline">Sign in</Link></div>
        </form>
      </div>
    </div>
  );
};

export default InviteAccept;
