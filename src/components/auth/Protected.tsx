import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthStore } from "@/lib/authStore";

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authed = AuthStore.isAuthed();
  const loc = useLocation();
  if (!authed) return <Navigate to="/auth/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
};

export default Protected;
