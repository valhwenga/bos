import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { AuthStore } from "@/lib/authStore";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Where a signed-in user lands when their account is not active.
 *
 * Without this they would reach the app shell with every module denied, which
 * looks like the system is broken rather than like an account waiting to be
 * approved.
 */
const AwaitingApproval: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const deactivated = profile?.status === "inactive";

  const signOut = async () => {
    await AuthStore.signOut();
    navigate("/auth/login", { replace: true });
  };

  return (
    <AuthShell
      title={deactivated ? "Account deactivated" : "Waiting for approval"}
      subtitle={
        deactivated
          ? "This account has been switched off. An administrator can turn it back on."
          : "Your account has been created. An administrator needs to approve it and assign your role before you can sign in."
      }
    >
      <div className="flex flex-col gap-4">
        {profile?.email && (
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{profile.email}</span>
          </p>
        )}
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
};

export default AwaitingApproval;
