import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecurityStore, User as UserType, Session } from '@/lib/securityStore';
import { Shield, Eye, EyeOff, AlertTriangle, Lock, User, Mail } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const SecureLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const navigate = useNavigate();

  const settings = SecurityStore.getSettings();

  useEffect(() => {
    // Check if user is already logged in
    const session = SecurityStore.getCurrentSession();
    if (session) {
      navigate('/dashboard');
    }

    // Check lockout status
    const attempts = parseInt(localStorage.getItem('login_attempts') || '0');
    const lockout = localStorage.getItem('lockout_until');
    
    if (lockout) {
      const lockUntil = new Date(lockout);
      if (new Date() < lockUntil) {
        setIsLocked(true);
        setLockoutTime(Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60)));
        const checkLockout = setInterval(() => {
          const remaining = Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60));
          if (remaining <= 0) {
            setIsLocked(false);
            setLoginAttempts(0);
            localStorage.removeItem('login_attempts');
            localStorage.removeItem('lockout_until');
            clearInterval(checkLockout);
          } else {
            setLockoutTime(remaining);
          }
        }, 1000);
      } else {
        localStorage.removeItem('lockout_until');
        setLoginAttempts(attempts);
      }
    } else {
      setLoginAttempts(attempts);
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) return;

    setIsLoading(true);
    
    try {
      const result = SecurityStore.authenticate(email, password);
      
      if (result.success) {
        // Reset login attempts
        localStorage.removeItem('login_attempts');
        localStorage.removeItem('lockout_until');
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${result.user?.name}!`,
        });
        
        navigate('/dashboard');
      } else {
        // Increment login attempts
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        localStorage.setItem('login_attempts', newAttempts.toString());
        
        // Check if should lock out
        if (newAttempts >= settings.maxLoginAttempts) {
          const lockUntil = new Date(Date.now() + settings.lockoutDuration * 60 * 1000);
          localStorage.setItem('lockout_until', lockUntil.toISOString());
          setIsLocked(true);
          setLockoutTime(settings.lockoutDuration);
        }
        
        toast({
          title: "Login Failed",
          description: result.error || 'Invalid credentials',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    return SecurityStore.validatePassword(password);
  };

  const passwordValidation = validatePassword(password);

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-700">Account Locked</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600">
              Too many failed login attempts. Your account has been locked for security reasons.
            </p>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="font-semibold text-red-800">
                Try again in: {lockoutTime} minutes
              </p>
              <p className="text-sm text-red-600">
                For security, please wait before attempting to login again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle>Secure Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the system
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* Password Requirements */}
              {password && (
                <div className="text-xs space-y-1 p-2 bg-muted rounded">
                  <p className="font-medium">Password Requirements:</p>
                  <div className={`flex items-center gap-1 ${passwordValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-3 h-3 rounded-full ${password.length >= settings.passwordMinLength ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>At least {settings.passwordMinLength} characters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-3 h-3 rounded-full ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-3 h-3 rounded-full ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                    <div className={`w-3 h-3 rounded-full ${/[0-9]/.test(password) ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>One number</span>
                  </div>
                </div>
              )}
            </div>

            {/* Login Attempts Warning */}
            {loginAttempts > 0 && !isLocked && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-700">
                  <strong>Warning:</strong> {loginAttempts} of {settings.maxLoginAttempts} attempts remaining.
                  Account will be locked after {settings.maxLoginAttempts} failed attempts.
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !email || !password || !passwordValidation.valid}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Security Features */}
          <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Secure authentication with audit logging
              </p>
              {settings.requireTwoFactor && (
                <p className="flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  Two-factor authentication enabled
                </p>
              )}
              <p className="flex items-center justify-center gap-1">
                <User className="w-3 h-3" />
                Session timeout: {settings.sessionTimeout} minutes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecureLogin;
