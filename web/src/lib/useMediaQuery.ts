import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Returns whether it currently matches and
 * updates on change. Used to switch the layout between desktop (sidebar always
 * visible) and mobile (sidebar as a slide-over drawer).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True on phone-sized viewports (≤ 720px wide). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 720px)");
}
