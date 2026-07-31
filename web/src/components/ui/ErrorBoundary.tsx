"use client";

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * A render crash on a phone otherwise shows a white page with no way out.
 * This keeps a reload path visible.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled UI error", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen-safe safe-area flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl">Something broke</h1>
        <p className="max-w-sm text-sm text-muted">
          The page hit an unexpected error. Reloading usually fixes it — your room stays open for a
          short while.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="tap-target rounded-2xl bg-[linear-gradient(135deg,#ff4d6d,#7c5cff)] px-6 text-sm font-medium text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}
