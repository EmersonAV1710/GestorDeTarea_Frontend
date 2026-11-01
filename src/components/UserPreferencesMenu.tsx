"use client";
import { t, setLanguage, useLanguage } from "../lib/language";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ThemeToggle } from "./ThemeToggle";

const accentColors = [
  { id: "default", label: "Original", color: "#a394ff" },
  { id: "blue", label: "Azul", color: "#2563eb" },
  { id: "violet", label: "Violeta", color: "#7c3aed" },
  { id: "green", label: "Verde", color: "#15803d" },
  { id: "rose", label: "Rosa", color: "#be185d" },
  { id: "orange", label: "Naranja", color: "#c2410c" },
  { id: "teal", label: "Turquesa", color: "#0f766e" },
  { id: "red", label: "Rojo", color: "#b91c1c" },
  { id: "amber", label: "Dorado", color: "#a16207" },
  { id: "lime", label: "Lima", color: "#4d7c0f" },
  { id: "cyan", label: "Cian", color: "#0e7490" },
  { id: "indigo", label: "Índigo", color: "#4338ca" },
  { id: "fuchsia", label: "Fucsia", color: "#a21caf" },
  { id: "silver", label: "Plata", color: "#475569" },
];

const backgroundColors = [
  { id: "default", label: "Original", color: "linear-gradient(135deg,#f8fafc,#cbd5e1)" },
  { id: "blue", label: "Océano", color: "linear-gradient(135deg,#93c5fd,#a5f3fc,#dbeafe)" },
  { id: "violet", label: "Aurora", color: "linear-gradient(135deg,#c4b5fd,#fbcfe8,#bfdbfe)" },
  { id: "mint", label: "Brisa", color: "linear-gradient(135deg,#a7f3d0,#a5f3fc,#ecfdf5)" },
  { id: "rose", label: "Atardecer", color: "linear-gradient(135deg,#fda4af,#fed7aa,#fbcfe8)" },
  { id: "sand", label: "Desierto", color: "linear-gradient(135deg,#fde68a,#fed7aa,#fef3c7)" },
  { id: "slate", label: "Neblina", color: "linear-gradient(135deg,#94a3b8,#c7d2fe,#e2e8f0)" },
  { id: "forest", label: "Bosque", color: "linear-gradient(135deg,#86b89b,#d9f99d,#bbf7d0)" },
];

export function UserPreferencesMenu({ username, guest = false, onSignIn }: { username: string; guest?: boolean; onSignIn?: () => void }) {
  const [open, setOpen] = useState(false);
  const language = useLanguage();
  const [background, setBackground] = useState("default");
  const [accent, setAccent] = useState("default");
  useEffect(() => {
    function sync() {
      let saved = "default";
      try { saved = localStorage.getItem("tarevia-accent") || "default"; } catch {}
      const next = accentColors.some(color => color.id === saved) ? saved : "default";
      document.documentElement.dataset.accent = next;
      setAccent(next);
      let savedBackground = "default";
      try { savedBackground = localStorage.getItem("tarevia-background") || "default"; } catch {}
      const nextBackground = backgroundColors.some(color => color.id === savedBackground) ? savedBackground : "default";
      document.documentElement.dataset.background = nextBackground;
      setBackground(nextBackground);
    }
    sync();
    function onStorage(event: StorageEvent) {
      if (event.key === "tarevia-accent" || event.key === "tarevia-background" || event.key === null) sync();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function chooseAccent(next: string) {
    setAccent(next);
    document.documentElement.dataset.accent = next;
    try { localStorage.setItem("tarevia-accent", next); } catch {}
  }
  function chooseBackground(next: string) {
    setBackground(next);
    document.documentElement.dataset.background = next;
    try { localStorage.setItem("tarevia-background", next); } catch {}
  }
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLSelectElement>("select")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return <div className="profile-settings-row"><div className="profile-summary">
    <span className="avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase() || "E"}</span>
    <span className="profile"><b>{guest ? t("Modo invitado") : username || t("Estudiante")}</b></span>
  </div><div className="user-preferences" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); closeAndFocus(); } }}>
    <button ref={trigger} type="button" className="settings-trigger" aria-expanded={open} aria-controls={menuId}
      aria-label={t("Configuración")} title={t("Configuración")} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2a7 7 0 0 0-1.6.9l-2-.6-2.5 4.3 1.5 1.4a7 7 0 0 0 0 1.9l-1.5 1.4 2.5 4.3 2-.6a7 7 0 0 0 1.6.9l.5 2h5l.5-2a7 7 0 0 0 1.6-.9l2 .6 2.5-4.3-1.5-1.4a7 7 0 0 0 0-1.9l1.5-1.4-2.5-4.3-2 .6A7 7 0 0 0 15 5l-.5-2z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
    {open && <div id={menuId} className="user-preferences-menu" role="region" aria-label={t("Configuración")}>
      <p>{t("Configuración")}</p>
      <label className="settings-language">{t("Idioma")}<select value={language} onChange={event => setLanguage(event.target.value === "en" ? "en" : "es")}><option value="es" lang="es">Español</option><option value="en" lang="en">English</option></select></label>
      <p>{t("Apariencia")}</p>
      <ThemeToggle showLabel />
      <fieldset className="settings-colors"><legend>{t("Color de la interfaz")}</legend>
        <div className="settings-color-options">{accentColors.map(color => <label key={color.id} className="settings-color-option" style={{ "--swatch": color.color } as CSSProperties} title={t(color.label)}>
          <input type="radio" name={`${menuId}-accent`} value={color.id} checked={accent === color.id} onChange={() => chooseAccent(color.id)} aria-label={t(color.label)} />
          <span aria-hidden="true">{accent === color.id ? "\u2713" : ""}</span>
        </label>)}</div>
        <span className="settings-color-name">{t(accentColors.find(color => color.id === accent)?.label || "Original")}</span>
      </fieldset>
      <fieldset className="settings-colors"><legend>{t("Tema del fondo")}</legend>
        <div className="settings-theme-options">{backgroundColors.map(color => <label key={color.id} className="settings-theme-option" style={{ "--swatch": color.color } as CSSProperties} title={t(color.label)}>
          <input type="radio" name={`${menuId}-background`} value={color.id} checked={background === color.id} onChange={() => chooseBackground(color.id)} aria-label={t(color.label)} />
          <span className="settings-theme-preview" aria-hidden="true">{background === color.id ? "\u2713" : ""}</span><span className="settings-theme-label">{t(color.label)}</span>
        </label>)}</div>
        <span className="settings-color-name">{t(backgroundColors.find(color => color.id === background)?.label || "Original")}</span>
      </fieldset>
      {guest && <><p className="guest-storage-note">{t("Tus tareas y cursos se guardan en este navegador. Se perderán si borras sus datos.")}</p><button type="button" className="guest-sign-in" onClick={() => { setOpen(false); onSignIn?.(); }}>{t("Iniciar sesión")}</button></>}
    </div>}
  </div></div>;
}
