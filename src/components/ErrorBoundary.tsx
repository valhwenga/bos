import React from "react";
import { toast } from "@/components/ui/use-toast";

type Props = { children: React.ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("UI ErrorBoundary caught: ", error);
    toast({ title: "Something went wrong", description: "An unexpected error occurred. Please try again." });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">We hit a snag</h2>
            <p className="text-muted-foreground">Please refresh the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
