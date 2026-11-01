"use client";

import { useSyncExternalStore } from "react";
import { english } from "./translations";

export type Language = "es" | "en";
let language: Language = "es";
const listeners = new Set<() => void>();
let initialized = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    try { language = localStorage.getItem("tarevia-language") === "en" ? "en" : "es"; } catch {}
    document.documentElement.lang = language;
    window.addEventListener("storage", event => {
      if (event.key === "tarevia-language" || event.key === null) {
        let next: Language = "es";
        try { next = localStorage.getItem("tarevia-language") === "en" ? "en" : "es"; } catch {}
        language = next;
        document.documentElement.lang = next;
        listeners.forEach(listener => listener());
      }
    });
  }
  return () => { listeners.delete(listener); };
}
export function setLanguage(next: Language) {
  language = next;
  document.documentElement.lang = next;
  try { localStorage.setItem("tarevia-language", next); } catch {}
  listeners.forEach(listener => listener());
}
export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language, () => "es" as Language);
}
export function locale() { return language === "en" ? "en-US" : "es-CR"; }
export function t(text: string): string { return language === "en" ? english[text] ?? text : text; }
