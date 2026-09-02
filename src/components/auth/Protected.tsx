import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

/**
 * Gates the signed-in area.
 *
 * The `loading` state matters: restoring a persisted session is asynchronous,
 * so treating "not signed in yet" as "signed out" would bounce the user to the
 * login page on every page refresh.
 */
const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, profile } = useAuth();
  const loc = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (status === "signed-out") {
    return <Navigate to="/auth/login" replace state={{ from: loc.pathname }} />;
  }

  // Signed in, but not yet approved or since deactivated. Sending them to the
  // app would show a shell with every module denied, which reads as breakage
  // rather than as a pending account.
  if (!profile || profile.status !== "active") {
    return <Navigate to="/auth/pending" replace />;
  }

  return <>{children}</>;
};

export default Protected;
