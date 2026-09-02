import React, { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { TwoFactor } from "@/lib/twoFactor";
import { AuthStore } from "@/lib/authStore";
import { useNavigate } from "react-router-dom";

/**
 * Blocks the app when the signed-in user's role requires a second factor and
 * their account has none.
 *
 * Enrolment is not offered as a suggestion here, because the role setting would
 * mean nothing if it could be dismissed. Signing out is the only other way
 * through, which is the honest choice to leave someone.
 */
const RequireTwoFactorEnrolment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const check = () => {
    void TwoFactor.isEnrolled().then(setEnrolled);
  };

  useEffect(check, []);

  // Unknown yet: render nothing rather than flashing the block screen at
  // somebody who already has a factor.
  if (enrolled === null) return null;
  if (enrolled) return <>{children}</>;

  const signOut = async () => {
    await AuthStore.signOut();
    navigate("/auth/login", { replace: true });
  };

  return (
    <AuthShell
      title="Two-factor authentication required"
      subtitle="Your role requires a second factor before you can use the system."
    >
      <div className="flex flex-col gap-4">
        <TwoFactorSetup enrolled={false} onChange={check} allowRemoval={false} />
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
};

export default RequireTwoFactorEnrolment;
