const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function sign() {
  return jwt.sign({ u: process.env.ADMIN_USERNAME || "admin" }, SECRET, { expiresIn: "7d" });
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function isAuthed(req) {
  try { jwt.verify(parseCookies(req).mv_token || "", SECRET); return true; }
  catch { return false; }
}
function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `mv_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${secure}`);
}
function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", "mv_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}
function checkLogin(username, password) {
  return username === (process.env.ADMIN_USERNAME || "admin") && password === (process.env.ADMIN_PASSWORD || "admin123");
}
module.exports = { sign, isAuthed, setAuthCookie, clearAuthCookie, checkLogin };
