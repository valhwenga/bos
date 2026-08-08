import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Tailwind's raw palette scales and inline hex values bypass the design tokens
 * in src/index.css. That is how dark mode broke: a page hardcodes text-gray-900
 * and stays dark-on-dark when the theme flips.
 *
 * Colour must come from a semantic token — bg-card, text-muted-foreground,
 * text-success, border-border — never from a palette scale.
 */
const RAW_PALETTE =
  "(bg|text|border|from|via|to|ring|fill|stroke|divide|placeholder|decoration|shadow|outline|accent|caret)-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)";

const RAW_PALETTE_MESSAGE =
  "Use a design token, not a Tailwind palette colour. bg-white -> bg-card, text-gray-900 -> text-foreground, text-gray-500 -> text-muted-foreground, text-green-600 -> text-success, text-red-600 -> text-danger. Tokens are defined in src/index.css.";

const HEX_MESSAGE =
  "Inline hex colours bypass theming and break dark mode. Add a token in src/index.css and reference it instead.";

// Selectors cover the three places a class string realistically appears:
// a plain literal, a template literal chunk, and any string passed to cn().
const noRawPalette = [
  {
    selector: `Literal[value=/${RAW_PALETTE}/]`,
    message: RAW_PALETTE_MESSAGE,
  },
  {
    selector: `TemplateElement[value.raw=/${RAW_PALETTE}/]`,
    message: RAW_PALETTE_MESSAGE,
  },
  {
    selector: 'JSXAttribute[name.name="className"] Literal[value=/#[0-9a-fA-F]{6}/]',
    message: HEX_MESSAGE,
  },
];

/**
 * Files that still carry pre-token colours. This list may shrink, never grow:
 * new files are checked from the start, and once a file is migrated its entry
 * comes out and it can never regress.
 */
const NOT_YET_MIGRATED = [
      "src/components/AnalyticsDashboard.tsx",
      "src/components/AuditReport.tsx",
      "src/components/AvatarGroup.tsx",
      "src/components/CommunicationDashboard.tsx",
      "src/components/DocumentDashboard.tsx",
      "src/components/EmergencyResponse.tsx",
      "src/components/EmployeeDocumentVault.tsx",
      "src/components/HighPriorityDashboard.tsx",
      "src/components/PerformanceGoals.tsx",
      "src/components/ProfessionalPayslipPreview.tsx",
      "src/components/SecureLogin.tsx",
      "src/components/UserManagement.tsx",
      "src/components/WorkflowDashboard.tsx",
      "src/components/ui/toast.tsx",
      "src/lib/hrmDepartmentsStore.ts",
      "src/pages/Analytics.tsx",
      "src/pages/CRMDeals.tsx",
      "src/pages/Communication.tsx",
      "src/pages/Dashboard.tsx",
      "src/pages/Documents.tsx",
      "src/pages/HRMAttendance.tsx",
      "src/pages/HRMDepartments.tsx",
      "src/pages/HRMEmployees.tsx",
      "src/pages/HRMLeave.tsx",
      "src/pages/HRMPayroll.tsx",
      "src/pages/HRMPerformance.tsx",
      "src/pages/NotFound.tsx",
      "src/pages/Projects.tsx",
      "src/pages/UserRole.tsx",
      "src/pages/Workflow.tsx",
      "src/pages/accounting/InvoicePrint.tsx",
      "src/pages/accounting/QuotationPrint.tsx",
      "src/pages/accounting/Reports.tsx",
      "src/pages/accounting/Settings.tsx",
      "src/pages/auth/ForgotPassword.tsx",
      "src/pages/auth/InviteAccept.tsx",
      "src/pages/auth/Login.tsx",
      "src/pages/auth/ResetPassword.tsx",
      "src/pages/auth/Signup.tsx",
      "src/pages/messenger/Chat.tsx",
      "src/pages/projects/Bug.tsx",
      "src/pages/projects/Calendar.tsx",
      "src/pages/support/Tickets.tsx",
      "src/pages/users/Clients.tsx",
      "src/pages/users/ManageUsers.tsx",
      "src/pages/whatsapp/Console.tsx",
];

export default tseslint.config(
  { ignores: ["dist", "api"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-syntax": ["error", ...noRawPalette],
    },
  },
  {
    // Downgraded to a warning only for files that predate the token system.
    files: NOT_YET_MIGRATED,
    rules: {
      "no-restricted-syntax": ["warn", ...noRawPalette],
    },
  },
);
