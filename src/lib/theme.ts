// Light/dark mode. The choice ("light", "dark" or "system") is kept in
// localStorage, so it applies before the first paint without a server round
// trip. themeScript runs inline in <head>: it sets data-theme on <html> and
// the theme-color meta (status bar color), and follows system changes and
// changes from the settings page.

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "themechange";

// The header color, so the status bar blends into it.
export const themeColors = { light: "#ffffff", dark: "#181e1b" };

export const themeScript = `(function () {
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var stored = null;
    try { stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch (e) {}
    var theme = stored === "light" || stored === "dark" ? stored : media.matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", ${JSON.stringify(themeColors)}[theme]);
  }
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", apply);
  window.addEventListener(${JSON.stringify(THEME_CHANGE_EVENT)}, apply);
})();`;

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "system";
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
