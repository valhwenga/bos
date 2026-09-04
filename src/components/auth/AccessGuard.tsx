import React from "react";
import { ShieldAlert } from "lucide-react";
import { canAccess, getCurrentRole } from "@/lib/accessControl";
import type { AccessLevel, ModuleKey } from "@/lib/rolesStore";

type Props = {
  module: ModuleKey;
  required?: AccessLevel;
  /** Render instead of the default notice. Pass `null` to render nothing. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

const NoAccess = ({ module }: { module: ModuleKey }) => {
  const role = getCurrentRole();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">You don't have access to this page</h1>
        <p className="text-sm text-muted-foreground">
          Your role ({role.name}) doesn't include the <span className="font-medium text-foreground">{module}</span> module.
          Ask an administrator to grant access if you need it.
        </p>
      </div>
    </div>
  );
};

export const AccessGuard: React.FC<Props> = ({ module, required = "view", fallback, children }) => {
  if (canAccess(module, required)) return <>{children}</>;
  return <>{fallback === undefined ? <NoAccess module={module} /> : fallback}</>;
};

export default AccessGuard;
