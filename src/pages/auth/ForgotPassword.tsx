import React, { useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rec = AuthStore.requestPasswordReset(email);
      setToken(rec.token);
    } catch (err: any) {
      setError(err.message || 'Unable to request reset');
    }
  };

  const resetLink = token ? `${location.origin}/auth/reset?token=${token}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] flex items-center justify-center p-6">
      <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-2xl font-semibold text-slate-900">Forgot Password</div>
          <div className="text-slate-500 mt-1">We'll generate a reset link</div>
        </div>
        {!token ? (
          <form onSubmit={onSubmit} className="p-6 pt-0 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Email</div>
              <Input value={email} onChange={(e)=> setEmail(e.target.value)} type="email" placeholder="you@company.com" required />
            </div>
            <Button type="submit" className="w-full">Send Reset Link</Button>
            <div className="text-center text-sm text-slate-600"><Link to="/auth/login" className="text-[#5F33FF] hover:underline">Back to Sign in</Link></div>
          </form>
        ) : (
          <div className="p-6 pt-0 space-y-3">
            <div className="text-green-700 font-medium">Reset link generated</div>
            <div className="text-sm text-slate-600 break-all">{resetLink}</div>
            <Button variant="secondary" className="w-full" onClick={()=> { navigator.clipboard?.writeText(resetLink); }}>Copy Link</Button>
            <Link to={resetLink} className="inline-block"><Button className="w-full">Open Reset Page</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
