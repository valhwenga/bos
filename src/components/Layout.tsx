import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Hidden below lg; the header serves the same nav in a drawer there. */}
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="scrollbar-subtle flex-1 overflow-x-hidden">
          {children ?? <Outlet />}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
};
