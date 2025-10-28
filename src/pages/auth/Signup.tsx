import React, { useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { CompanySettingsStore } from "@/lib/companySettings";

const Signup: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      AuthStore.signUpRequest(name, email, password);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    }
  };

  const cs = CompanySettingsStore.get();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5F33FF] to-[#7A60D9] flex items-center justify-center p-6">
      <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
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
          <div className="text-2xl font-semibold text-slate-900">Create your account</div>
          <div className="text-slate-500 mt-1">Request access to the system</div>
          <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1 relative">
            <Link to="/auth/login" className="px-4 py-1.5 text-sm rounded-full text-slate-700 hover:text-slate-900 hover:rotate-[-1deg] transition-all">Sign In</Link>
            <Link to="/auth/signup" className="px-4 py-1.5 text-sm rounded-full bg-white text-slate-900 shadow transition-transform duration-300">Sign Up</Link>
          </div>
        </div>
        {!submitted ? (
          <form onSubmit={onSubmit} className="p-6 pt-0 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Full name</div>
              <Input value={name} onChange={e=> setName(e.target.value)} placeholder="Jane Doe" required />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Email</div>
              <Input value={email} onChange={e=> setEmail(e.target.value)} type="email" placeholder="you@company.com" required />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Password</div>
              <Input value={password} onChange={e=> setPassword(e.target.value)} type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full">Request Access</Button>
            <div className="text-center text-sm text-slate-600">Already have an account? <Link to="/auth/login" className="text-[#5F33FF] hover:underline">Sign in</Link></div>
          </form>
        ) : (
          <div className="p-6 pt-0 text-center space-y-3">
            <div className="text-green-700 font-medium">Your request has been submitted.</div>
            <div className="text-sm text-slate-600">An administrator will review and approve your access. You'll be able to sign in once approved.</div>
            <Link to="/auth/login" className="inline-block"><Button variant="outline">Back to Sign in</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
