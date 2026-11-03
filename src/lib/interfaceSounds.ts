"use client";

import { useEffect } from "react";

let audio: AudioContext | undefined;
let lastClick = 0;

export function playInterfaceSound(kind: "click" | "success" | "error" = "click") {
  if (typeof document === "undefined" || document.documentElement.dataset.sounds === "off") return;
  try {
    if (!window.AudioContext) return;
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    // Quiet, rounded taps with a brief, airy confirmation for completed work.
    const notes = kind === "success"
      ? [
        { frequency: 160, end: 110, offset: 0, duration: 0.06, volume: 0.022 },
        { frequency: 349.23, end: 349.23, offset: 0.025, duration: 0.1, volume: 0.018 },
        { frequency: 466.16, end: 466.16, offset: 0.105, duration: 0.17, volume: 0.022 },
      ]
      : kind === "error"
        ? [
          { frequency: 220, end: 200, offset: 0, duration: 0.08, volume: 0.02 },
          { frequency: 165, end: 145, offset: 0.08, duration: 0.1, volume: 0.02 },
        ]
        : [{ frequency: 230, end: 160, offset: 0, duration: 0.06, volume: 0.025 }];
    notes.forEach(note => {
      const start = audio!.currentTime + note.offset;
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.end, start + note.duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(gain);
      gain.connect(audio!.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.01);
    });
  } catch { /* Sound must never interrupt an action. */ }
}

export function useInterfaceSounds() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    function click(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-sound-ignore]")) return;
      const control = event.target.closest('button, a[href], summary, select, input[type="checkbox"], input[type="radio"]');
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      const now = Date.now();
      if (now - lastClick < 140) return;
      lastClick = now;
      playInterfaceSound();
    }
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
}
