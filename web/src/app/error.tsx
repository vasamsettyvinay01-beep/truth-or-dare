"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl tracking-wide">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">
        The page hit an unexpected error. You can try again or return home.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/5"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
