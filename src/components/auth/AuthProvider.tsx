import React, { useEffect, useState } from "react";
import {
  getSession,
  startSessionTracking,
  subscribeSession,
  type SessionSnapshot,
} from "@/lib/session";

/**
 * Keeps React in step with the session snapshot.
 *
 * The snapshot itself lives outside React so that non-component code
 * (canAccess, the stores) can read it synchronously; this subscribes so the
 * tree re-renders when someone signs in, signs out, or has their role changed.
 */
export function useAuth(): SessionSnapshot {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(getSession);
  useEffect(() => subscribeSession(setSnapshot), []);
  return snapshot;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    startSessionTracking();
  }, []);
  return <>{children}</>;
};

export default AuthProvider;
