"use client";

import { useEffect, useState } from "react";

/**
 * Matches a media query without breaking hydration: the server and the first
 * client render always agree on `false`, then the real value lands in an effect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Tailwind's `sm` breakpoint, i.e. phone-sized viewports. */
export function useIsSmallScreen() {
  return useMediaQuery("(max-width: 640px)");
}
