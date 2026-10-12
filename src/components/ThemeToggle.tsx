"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
  );

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      let saved: string | null = null;
      try { saved = localStorage.getItem("tarevia-theme"); } catch {}
      const isDark = saved === "dark" || (saved !== "light" && system.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      setDark(isDark);
    }
    sync();
    system.addEventListener("change", sync);
    function onStorage(event: StorageEvent) {
      if (event.key === "tarevia-theme" || event.key === null) sync();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      system.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = !dark;
    const theme = next ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    setDark(next);
    try { localStorage.setItem("tarevia-theme", theme); } catch {}
  }

  if (showLabel) {
    return <button type="button" className="theme-toggle theme-switch" role="switch" aria-checked={dark} aria-label="Modo oscuro" onClick={toggle}>
      <span>Modo oscuro</span>
      <span className="theme-switch-track" aria-hidden="true"><span className="theme-switch-thumb" /></span>
    </button>;
  }

  const label = dark ? "Activar modo claro" : "Activar modo oscuro";
  return <button type="button" className="theme-toggle" onClick={toggle} title={label} aria-label={label} aria-pressed={dark}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
        : <path d="M20.5 13.4A8.8 8.8 0 0 1 10.6 3.5a8.8 8.8 0 1 0 9.9 9.9Z" />}
    </svg>
  </button>;
}
