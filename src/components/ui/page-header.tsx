import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; to?: string };

interface PageHeaderProps {
  title: string;
  /** One line explaining what this page is for. Skip it when the title says everything. */
  description?: string;
  breadcrumbs?: Crumb[];
  /** Primary and secondary actions, right-aligned. */
  actions?: React.ReactNode;
  /** Filters, tabs or summary tiles that belong with the header. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The standard top of every page. Using this instead of ad-hoc markup is what
 * makes titles, spacing and action placement consistent across modules.
 */
export const PageHeader = ({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: PageHeaderProps) => (
  <div className={cn("flex flex-col gap-4", className)}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {crumb.to && !last ? (
                  <Link to={crumb.to} className="rounded-xs transition-colors duration-fast hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn(last && "text-foreground")}>
                    {crumb.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-3 w-3 text-subtle" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
    )}

    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>

    {children}
  </div>
);
