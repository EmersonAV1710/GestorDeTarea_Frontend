"use client";

import { useEffect, useRef } from "react";

export function useScreenScroll(screen: string, hasExplicitTarget = false) {
  const positions = useRef(new Map<string, number>());
  const explicitTarget = useRef(hasExplicitTarget);
  explicitTarget.current = hasExplicitTarget;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
    // Explicit navigation to a task or document controls its own scrolling.
    if (!explicitTarget.current) {
      window.scrollTo({ top: positions.current.get(screen) ?? 0, left: 0, behavior: "instant" });
    }
    const remember = () => positions.current.set(screen, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [screen]);
}
