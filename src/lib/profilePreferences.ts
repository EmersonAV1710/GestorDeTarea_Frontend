const preferenceNames = ["theme", "accent", "background", "language", "sounds", "dark_style"] as const;
type PreferenceName = typeof preferenceNames[number];
export type Preferences = Partial<Record<PreferenceName, string>>;
let activeProfile = "guest";
let accessToken = "";
let saveQueue: Promise<void> = Promise.resolve();
const API = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:8000/api";

function persistPreferences(values: Preferences) {
  if (!accessToken) return;
  const token = accessToken;
  const profile = activeProfile;
  const notify = (status: string) => {
    if (token === accessToken && profile === activeProfile) {
      window.dispatchEvent(new CustomEvent("tarevia-preference-save", { detail: status }));
    }
  };
  notify("saving");
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    try {
      const response = await fetch(`${API}/profile/preferences`, {
        method: "PATCH",
        keepalive: true,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw Error("Preference save failed");
      notify("saved");
    } catch {
      notify("error");
    }
  });
}

function profileKey(profile: string, name: PreferenceName) {
  return `tarevia-profile:${encodeURIComponent(profile)}:${name}`;
}

export function savePreference(name: PreferenceName, value: string) {
  try {
    localStorage.setItem(profileKey(activeProfile, name), value);
    localStorage.setItem(`tarevia-${name}`, value);
  } catch { /* Appearance still works when browser storage is unavailable. */ }
  persistPreferences({ [name]: value });
}

export function selectPreferenceProfile(username?: string, token = "", preferences?: Preferences | null) {
  activeProfile = username ? `user:${username.trim().toLowerCase()}` : "guest";
  accessToken = token;
  if (typeof document === "undefined") return;
  const initial: Preferences = {};
  for (const name of preferenceNames) {
    const key = `tarevia-${name}`;
    try {
      const saved = preferences !== undefined && preferences !== null
        ? preferences[name] ?? null
        : localStorage.getItem(profileKey(activeProfile, name));
      if (saved === null) localStorage.removeItem(key);
      else {
        localStorage.setItem(key, saved);
        localStorage.setItem(profileKey(activeProfile, name), saved);
        initial[name] = saved;
      }
    } catch { /* Use defaults when storage is unavailable. */ }
  }
  let theme: string | null = null;
  let accent = "default";
  let background = "default";
  try {
    theme = localStorage.getItem("tarevia-theme");
    accent = localStorage.getItem("tarevia-accent") || "default";
    background = localStorage.getItem("tarevia-background") || "default";
  } catch {}
  document.documentElement.dataset.theme = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  document.documentElement.dataset.accent = accent;
  document.documentElement.dataset.background = background;
  try { document.documentElement.dataset.darkStyle = localStorage.getItem("tarevia-dark_style") === "black" ? "black" : "gray"; }
  catch { document.documentElement.dataset.darkStyle = "gray"; }
  try { document.documentElement.dataset.sounds = localStorage.getItem("tarevia-sounds") === "off" ? "off" : "on"; }
  catch { document.documentElement.dataset.sounds = "on"; }
  // Refresh mounted appearance controls and the language store in this tab.
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
  // Move existing browser preferences into the account on its first server save.
  if (preferences === null && Object.keys(initial).length) persistPreferences(initial);
}
