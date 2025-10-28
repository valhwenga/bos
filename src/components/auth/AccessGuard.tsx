import React from "react";
import { canAccess } from "@/lib/accessControl";
import type { ModuleKey } from "@/lib/rolesStore";

type Props = {
  module: ModuleKey;
  required?: "view" | "edit" | "full";
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export const AccessGuard: React.FC<Props> = ({ module, required = "view", fallback = null, children }) => {
  if (!canAccess(module, required)) return <>{fallback}</>;
  return <>{children}</>;
};

export default AccessGuard;
