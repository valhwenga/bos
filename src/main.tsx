import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted so type never depends on a third-party request. Must precede
// index.css so our @layer base rules win over the font package's.
import "@fontsource-variable/inter";
import "./index.css";

import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ErrorBoundary>,
);
