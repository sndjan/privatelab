// What the browser remembers about the last signed-in session, so pages can
// show the signed-in layout right away instead of waiting for the server to
// check the session. It is only a hint for the first paint: the server still
// decides what is shown and allowed, and replaces it once it has answered.
//
// sessionScript runs inline in <head> and sets data-signed-in on <html>
// before the first paint, which the `signed-in:` CSS variant reacts to.

const SESSION_KEY = "session";

export type SessionHint = {
  isAdmin: boolean;
  // Module ids from the last dashboard visit.
  moduleIds?: string[];
};

export const sessionScript = `(function () {
  try {
    if (localStorage.getItem(${JSON.stringify(SESSION_KEY)})) document.documentElement.dataset.signedIn = "";
  } catch (e) {}
})();`;

export function readSessionHint(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function parseSessionHint(raw: string | null): SessionHint | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionHint;
  } catch {
    return null;
  }
}

// Merges into the stored hint, or clears it when signed out.
export function writeSessionHint(update: Partial<SessionHint> | null) {
  try {
    if (update) {
      const next = { ...parseSessionHint(readSessionHint()), ...update };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      document.documentElement.dataset.signedIn = "";
    } else {
      localStorage.removeItem(SESSION_KEY);
      delete document.documentElement.dataset.signedIn;
    }
  } catch {}
}
