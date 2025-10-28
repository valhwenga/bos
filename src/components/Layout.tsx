import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Outlet } from "react-router-dom";

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
};
