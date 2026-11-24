export const THEME_KEY = "ilao-theme";
export type Theme = "light" | "dark";

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark";

const META_COLORS: Record<Theme, string> = { light: "#f2f2f7", dark: "#000000" };

/**
 * Runs in <head> before first paint so the saved theme never flashes the wrong colors.
 * Until a theme is chosen in the app, the device's current setting is used.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

/** The saved theme, or the device setting if none was chosen yet. Client only. */
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isTheme(saved)) return saved;
  } catch {
    // Storage unavailable: fall back to the device setting.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies a theme to the page and the browser/status-bar color. Client only. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = META_COLORS[theme];
  });
}
