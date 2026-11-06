// js/session.js
// Tiny shared client-side session helper used by every page.
// The logged-in user (returned by /api/auth/login) is kept in
// localStorage, and its user_id is sent as the x-user-id header the
// backend uses for role-based access control.

const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem("marketlyUser") || "null"); }
    catch (e) { return null; }
  },
  set(user) { localStorage.setItem("marketlyUser", JSON.stringify(user)); },
  clear() { localStorage.removeItem("marketlyUser"); },

  // Standard headers for API calls: JSON + the caller's id.
  headers(extra) {
    const u = this.get();
    const h = { "Content-Type": "application/json" };
    if (u) h["x-user-id"] = u.user_id;
    return Object.assign(h, extra || {});
  },

  // Guard a page. No user -> login; wrong role -> home.
  require(role) {
    const u = this.get();
    if (!u) { location.href = "login.html"; return null; }
    if (role && u.role !== role) { location.href = "index.html"; return null; }
    return u;
  },

  logout() { this.clear(); location.href = "index.html"; }
};
