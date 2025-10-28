import React, { useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams, Link, useNavigate } from "react-router-dom";

const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const nav = useNavigate();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    try {
      AuthStore.resetPassword(token, password);
      setDone(true);
      setTimeout(()=> nav('/auth/login'), 800);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] flex items-center justify-center p-6">
      <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-2xl font-semibold text-slate-900">Reset Password</div>
          <div className="text-slate-500 mt-1">Enter a new password</div>
        </div>
        {!done ? (
          <form onSubmit={onSubmit} className="p-6 pt-0 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
            <div className="space-y-1">
              <div className="text-xs text-slate-600">New password</div>
              <Input value={password} onChange={(e)=> setPassword(e.target.value)} type="password" placeholder="••••••••" required />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Confirm password</div>
              <Input value={confirm} onChange={(e)=> setConfirm(e.target.value)} type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full">Reset Password</Button>
            <div className="text-center text-sm text-slate-600"><Link to="/auth/login" className="text-[#5F33FF] hover:underline">Back to Sign in</Link></div>
          </form>
        ) : (
          <div className="p-6 pt-0 text-center space-y-3">
            <div className="text-green-700 font-medium">Password updated</div>
            <div className="text-sm text-slate-600">Redirecting to sign in...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
