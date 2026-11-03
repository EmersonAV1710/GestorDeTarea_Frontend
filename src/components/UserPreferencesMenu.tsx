"use client";
import { playInterfaceSound } from "../lib/interfaceSounds";
import { savePreference } from "../lib/profilePreferences";
import { t, setLanguage, useLanguage } from "../lib/language";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

const accentColors = [
  { id: "default", label: "Original", color: "#a394ff" },
  { id: "red", label: "Rojo", color: "#e51b32" },
  { id: "coral", label: "Coral", color: "#e63752" },
  { id: "orange", label: "Naranja", color: "#de4800" },
  { id: "copper", label: "Cobre", color: "#c45512" },
  { id: "amber", label: "Dorado", color: "#ab7200" },
  { id: "lime", label: "Lima", color: "#5c8700" },
  { id: "olive", label: "Oliva", color: "#69800a" },
  { id: "green", label: "Verde", color: "#079541" },
  { id: "teal", label: "Turquesa", color: "#008b7b" },
  { id: "cyan", label: "Cian", color: "#0087ad" },
  { id: "ocean", label: "Petróleo", color: "#007db0" },
  { id: "blue", label: "Azul", color: "#1761ef" },
  { id: "indigo", label: "Índigo", color: "#5040ed" },
  { id: "violet", label: "Violeta", color: "#8429ef" },
  { id: "grape", label: "Uva", color: "#9c20dc" },
  { id: "fuchsia", label: "Fucsia", color: "#c512cf" },
  { id: "raspberry", label: "Frambuesa", color: "#dd126b" },
  { id: "rose", label: "Rosa", color: "#e01b87" },
  { id: "silver", label: "Plata", color: "#64748b" },
];

const backgroundColors = [
  { id: "default", label: "Original", color: "linear-gradient(135deg,#f8fafc,#cbd5e1)" },
  { id: "porcelain", label: "Porcelana", color: "linear-gradient(135deg,#edf0fa,#f7edfa,#fafbff)" },
  { id: "slate", label: "Neblina", color: "linear-gradient(135deg,#94a3b8,#c7d2fe,#e2e8f0)" },
  { id: "sky", label: "Cielo", color: "linear-gradient(135deg,#cceaff,#e0f2fe,#f1f9ff)" },
  { id: "blue", label: "Océano", color: "linear-gradient(135deg,#93c5fd,#a5f3fc,#dbeafe)" },
  { id: "lagoon", label: "Laguna", color: "linear-gradient(135deg,#99f6e4,#bae6fd,#eafafa)" },
  { id: "mint", label: "Brisa", color: "linear-gradient(135deg,#a7f3d0,#a5f3fc,#ecfdf5)" },
  { id: "pistachio", label: "Pistacho", color: "linear-gradient(135deg,#e3f0c7,#d6f2df,#f5faee)" },
  { id: "forest", label: "Bosque", color: "linear-gradient(135deg,#86b89b,#d9f99d,#bbf7d0)" },
  { id: "vanilla", label: "Vainilla", color: "linear-gradient(135deg,#fff0c2,#ffe7d1,#fffaf0)" },
  { id: "sand", label: "Desierto", color: "linear-gradient(135deg,#fde68a,#fed7aa,#fef3c7)" },
  { id: "coffee", label: "Café", color: "linear-gradient(135deg,#d6b79a,#fde5b8,#f7f1eb)" },
  { id: "peach", label: "Durazno", color: "linear-gradient(135deg,#fed7aa,#fecdd3,#fff4ed)" },
  { id: "rose", label: "Atardecer", color: "linear-gradient(135deg,#fda4af,#fed7aa,#fbcfe8)" },
  { id: "petals", label: "Pétalos", color: "linear-gradient(135deg,#fce0ed,#fae8ff,#fff6fa)" },
  { id: "cherry", label: "Cerezo", color: "linear-gradient(135deg,#fbcfe8,#ddd6fe,#fff1f4)" },
  { id: "lilac", label: "Lila", color: "linear-gradient(135deg,#e9deff,#e5e9ff,#f8f5ff)" },
  { id: "lavender", label: "Lavanda", color: "linear-gradient(135deg,#ddd6fe,#f5d0fe,#f5f0ff)" },
  { id: "violet", label: "Aurora", color: "linear-gradient(135deg,#c4b5fd,#fbcfe8,#bfdbfe)" },
  { id: "galaxy", label: "Galaxia", color: "linear-gradient(135deg,#c4b5fd,#a5b4fc,#f0efff)" },
];

function SettingsSection({ title, selected, children }: { title: string; selected: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <section className="settings-disclosure" data-open={expanded}>
    <button type="button" className="settings-disclosure-trigger" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span>{title}<small>{selected}</small></span>
    </button>
    <div id={id} className="settings-disclosure-content" aria-hidden={!expanded} inert={!expanded}>
      <div className="settings-disclosure-inner">{children}</div>
    </div>
  </section>;
}

export function UserPreferencesMenu({ username, guest = false, onSignIn }: { username: string; guest?: boolean; onSignIn?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [sounds, setSounds] = useState(true);
  const [darkStyle, setDarkStyle] = useState("gray");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = (event: Event) => setSaveStatus((event as CustomEvent<string>).detail);
    window.addEventListener("tarevia-preference-save", update);
    return () => window.removeEventListener("tarevia-preference-save", update);
  }, []);
  const language = useLanguage();
  const [background, setBackground] = useState("default");
  const [accent, setAccent] = useState("default");
  useEffect(() => {
    function sync() {
      setDarkStyle(document.documentElement.dataset.darkStyle === "black" ? "black" : "gray");
      setSounds(document.documentElement.dataset.sounds !== "off");
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
      if (event.key === "tarevia-accent" || event.key === "tarevia-background" || event.key === "tarevia-sounds" || event.key === "tarevia-dark_style" || event.key === null) sync();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function toggleSounds() {
    const next = !sounds;
    setSounds(next);
    document.documentElement.dataset.sounds = next ? "on" : "off";
    savePreference("sounds", next ? "on" : "off");
    if (next) playInterfaceSound();
  }
  function chooseAccent(next: string) {
    setAccent(next);
    document.documentElement.dataset.accent = next;
    try { savePreference("accent", next); } catch {}
  }
  function chooseBackground(next: string) {
    setBackground(next);
    document.documentElement.dataset.background = next;
    try { savePreference("background", next); } catch {}
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
    function positionMenu() {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const width = Math.min(300, viewportWidth - 24);
      const above = Math.max(0, anchor.top - 20);
      const below = Math.max(0, viewportHeight - anchor.bottom - 20);
      const upwards = above >= below;
      const maxHeight = Math.min(560, Math.max(above, below));
      const height = Math.min(menu.current?.scrollHeight ?? maxHeight, maxHeight);
      setMenuStyle({ position: "fixed", visibility: "visible", width, maxHeight,
        left: Math.max(12, Math.min(anchor.left, viewportWidth - width - 12)),
        top: upwards ? Math.max(12, anchor.top - height - 8) : anchor.bottom + 8,
        bottom: "auto", right: "auto" });
    }
    positionMenu();
    const observer = new ResizeObserver(positionMenu);
    if (menu.current) observer.observe(menu.current);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.visualViewport?.addEventListener("resize", positionMenu);
    root.current?.querySelector<HTMLSelectElement>("select")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      observer.disconnect();
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.visualViewport?.removeEventListener("resize", positionMenu);
    };
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
    {open && <div ref={menu} style={menuStyle} id={menuId} className="user-preferences-menu" role="region" aria-label={t("Configuración")}>
      <p>{t("Configuración")}</p>
      <label className="settings-language">{t("Idioma")}<select value={language} onChange={event => setLanguage(event.target.value === "en" ? "en" : "es")}><option value="es" lang="es">Español</option><option value="en" lang="en">English</option></select></label>
      <p>{t("Apariencia")}</p>
      <ThemeToggle showLabel />
      <label className="settings-language settings-dark-style">{t("Estilo del modo oscuro")}
        <select value={darkStyle} onChange={event => {
          const next = event.target.value === "black" ? "black" : "gray";
          setDarkStyle(next);
          document.documentElement.dataset.darkStyle = next;
          savePreference("dark_style", next);
        }}>
          <option value="gray">{t("Gris oscuro")}</option>
          <option value="black">{t("Negro")}</option>
        </select>
      </label>
      <button type="button" className="theme-toggle theme-switch settings-sounds" role="switch" aria-checked={sounds} onClick={toggleSounds} data-sound-ignore>
        <span>{t("Sonidos")}</span><span className="theme-switch-track" aria-hidden="true"><span className="theme-switch-thumb" /></span>
      </button>
      {!guest && saveStatus && <p role="status">{t(saveStatus === "error" ? "No se pudo guardar en tu cuenta. Vuelve a seleccionar la opción para reintentar." : saveStatus === "saving" ? "Guardando preferencias…" : "Preferencias guardadas en tu cuenta")}</p>}
      <SettingsSection title={t("Color de la interfaz")} selected={t(accentColors.find(color => color.id === accent)?.label || "Original")}><fieldset className="settings-colors"><legend className="sr-only">{t("Color de la interfaz")}</legend>
        <div className="settings-color-options">{accentColors.map(color => <label key={color.id} className="settings-color-option" style={{ "--swatch": color.color } as CSSProperties} title={t(color.label)}>
          <input type="radio" name={`${menuId}-accent`} value={color.id} checked={accent === color.id} onChange={() => chooseAccent(color.id)} aria-label={t(color.label)} />
          <span aria-hidden="true">{accent === color.id ? "\u2713" : ""}</span>
        </label>)}</div>
        <span className="settings-color-name">{t(accentColors.find(color => color.id === accent)?.label || "Original")}</span>
      </fieldset></SettingsSection>
      <SettingsSection title={t("Tema del fondo")} selected={t(backgroundColors.find(color => color.id === background)?.label || "Original")}><fieldset className="settings-colors"><legend className="sr-only">{t("Tema del fondo")}</legend>
        <div className="settings-theme-options">{backgroundColors.map(color => <label key={color.id} className="settings-theme-option" style={{ "--swatch": color.color } as CSSProperties} title={t(color.label)}>
          <input type="radio" name={`${menuId}-background`} value={color.id} checked={background === color.id} onChange={() => chooseBackground(color.id)} aria-label={t(color.label)} />
          <span className="settings-theme-preview" aria-hidden="true">{background === color.id ? "\u2713" : ""}</span><span className="settings-theme-label">{t(color.label)}</span>
        </label>)}</div>
        <span className="settings-color-name">{t(backgroundColors.find(color => color.id === background)?.label || "Original")}</span>
      </fieldset></SettingsSection>
      {guest && <><p className="guest-storage-note">{t("Tus tareas y cursos se guardan en este navegador. Se perderán si borras sus datos.")}</p><button type="button" className="guest-sign-in" onClick={() => { setOpen(false); onSignIn?.(); }}>{t("Iniciar sesión")}</button></>}
    </div>}
  </div></div>;
}
