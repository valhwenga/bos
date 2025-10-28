import React, { useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanySettingsStore } from "@/lib/companySettings";

const Login: React.FC = () => {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string>("");
  const nav = useNavigate();
  const loc = useLocation() as any;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      AuthStore.signIn(email, password);
      const to = loc.state?.from || "/";
      nav(to, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };
  const cs = CompanySettingsStore.get();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] flex items-center justify-center p-6">
      <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 pb-3 text-center">
          <div className="flex items-center justify-center mb-2">
            {cs.logoDataUrl ? (
              <img src={cs.logoDataUrl} alt="logo" className="h-10 w-auto drop-shadow-sm" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] text-white flex items-center justify-center text-sm font-semibold">
                {(cs.name||'S').slice(0,2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-2xl font-semibold text-slate-900">Welcome Back</div>
          <div className="text-slate-500 mt-1">Sign in to continue</div>
          <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1 relative">
            <span className="absolute inset-0 pointer-events-none" />
            <Link to="/auth/login" className="px-4 py-1.5 text-sm rounded-full bg-white text-slate-900 shadow transition-transform duration-300">Sign In</Link>
            <Link to="/auth/signup" className="px-4 py-1.5 text-sm rounded-full text-slate-700 hover:text-slate-900 hover:rotate-[-1deg] transition-all">Sign Up</Link>
          </div>
        </div>
        <form onSubmit={onSubmit} className="p-6 pt-0 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Email</div>
            <Input value={email} onChange={e=> setEmail(e.target.value)} type="email" placeholder="you@company.com" required />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Password</div>
            <Input value={password} onChange={e=> setPassword(e.target.value)} type="password" placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full">Sign In</Button>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <Link to="/auth/forgot" className="text-[#5F33FF] hover:underline">Forgot password?</Link>
            <span>No account? <Link to="/auth/signup" className="text-[#5F33FF] hover:underline">Request access</Link></span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
