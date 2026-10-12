"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function UserPreferencesMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(".theme-toggle")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return <div className="user-preferences" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); closeAndFocus(); } }}>
    <button ref={trigger} type="button" className="user-preferences-trigger" aria-expanded={open} aria-controls={menuId}
      aria-label={`Preferencias de ${username || "Estudiante"}`} onClick={() => setOpen(value => !value)}>
      <span className="avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase() || "E"}</span>
      <span className="profile"><b>{username || "Estudiante"}</b></span>
      <svg className="user-preferences-arrow" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
    </button>
    {open && <div id={menuId} className="user-preferences-menu" aria-label="Preferencias del usuario">
      <p>Apariencia</p>
      <ThemeToggle showLabel />
    </div>}
  </div>;
}
