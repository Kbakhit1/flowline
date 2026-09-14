"use client";

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Last line of defence for the demo: a render error shows a reset button
 * instead of a blank screen. Resetting clears the saved demo state.
 */
export class DemoErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => {
    try {
      localStorage.removeItem("flowline-demo");
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold">حدث خطأ في العرض التجريبي · Something went wrong</p>
        <p className="max-w-sm text-xs text-muted-foreground" dir="ltr">
          {this.state.error.message}
        </p>
        <button onClick={this.reset} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          إعادة ضبط العرض · Reset the demo
        </button>
      </div>
    );
  }
}
