import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl tracking-wide">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        That route does not exist. Check the invite link or start from the home page.
      </p>
      <Link
        href="/"
        className="rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15"
      >
        Home
      </Link>
    </main>
  );
}
