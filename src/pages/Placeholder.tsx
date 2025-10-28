import React from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const toTitle = (path: string) =>
  path
    .replace(/^\//, "")
    .split("/")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" · ") || "Home";

const Placeholder: React.FC = () => {
  const { pathname } = useLocation();
  const title = toTitle(pathname);
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page is not implemented yet. All routes are wired to avoid 404 errors.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Placeholder;
