import * as React from "react";
import { CompanySettingsStore } from "@/lib/companySettings";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Links or secondary actions below the card. */
  footer?: React.ReactNode;
}

/**
 * Shared frame for sign-in, sign-up, invite and password reset, so the five
 * screens stop each inventing their own layout and colours.
 *
 * A split layout: the brand panel carries the identity, the form column stays
 * calm and legible. Below lg the panel drops away and the form centres.
 */
export const AuthShell = ({ title, subtitle, children, footer }: AuthShellProps) => {
  const company = CompanySettingsStore.get();
  const name = company.name || "Your Company";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Depth without a stock gradient: two soft radial washes of the accent. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(60rem 40rem at 15% 10%, hsl(0 0% 100% / 0.16), transparent 60%), radial-gradient(45rem 35rem at 85% 90%, hsl(0 0% 0% / 0.22), transparent 60%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          {/* On the accent panel the logo sits on a card chip so a dark or
              single-colour logo stays visible against the brand colour. */}
          <img
            src={company.logoDataUrl || "/logo.svg"}
            alt=""
            className="h-10 w-10 rounded-md bg-card object-contain p-1.5"
          />
          <span className="text-sm font-semibold text-primary-foreground">{name}</span>
        </div>

        <div className="relative flex flex-col gap-4">
          <p className="max-w-md text-3xl font-semibold leading-tight text-primary-foreground">
            Everything your business runs on, in one place.
          </p>
          <p className="max-w-md text-md text-primary-foreground/75">
            Quotes and invoicing, customers and deals, people and payroll, projects and support —
            one system instead of six.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {name}
        </p>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center bg-background px-5 py-12">
        <div className="flex w-full max-w-sm flex-col gap-7">
          {/* The company's own logo leads the form, so the screen is branded as
              theirs on every breakpoint rather than only on the wide panel. */}
          <div className="flex items-center gap-3">
            <img
              src={company.logoDataUrl || "/logo.svg"}
              alt={name}
              className="h-12 w-12 shrink-0 rounded-md object-contain"
            />
            <span className="truncate text-lg font-semibold text-foreground">{name}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

/** Consistent inline error presentation across the auth screens. */
export const AuthError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
};
