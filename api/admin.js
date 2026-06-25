const db = require("../lib/db");
const auth = require("../lib/auth");

module.exports = async (req, res) => {
  try {
    const action = req.query.action;

    // ---- login / logout don't require an existing session ----
    if (action === "login") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const { username, password } = req.body || {};
      if (!auth.checkLogin(username, password)) return res.status(401).json({ error: "Incorrect username or password" });
      auth.setAuthCookie(res, auth.sign());
      return res.status(200).json({ ok: true });
    }
    if (action === "logout") {
      auth.clearAuthCookie(res);
      return res.status(200).json({ ok: true });
    }

    // ---- everything below requires auth ----
    if (!auth.isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
    await db.ensureSeed();

    if (action === "me") return res.status(200).json({ username: process.env.ADMIN_USERNAME || "admin" });

    if (action === "stats") {
      const orders = await db.getOrders();
      const products = await db.getProducts();
      const revenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
      return res.status(200).json({
        revenue, orderCount: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        productCount: products.length,
        lowStock: products.filter(p => p.stock <= 5).length,
        recentOrders: orders.slice(0, 5),
      });
    }

    if (action === "products") {
      if (req.method === "GET") return res.status(200).json(await db.getProducts());
      if (req.method === "POST") return res.status(200).json(await db.createProduct(req.body || {}));
      if (req.method === "PUT") {
        const p = await db.updateProduct(req.query.id, req.body || {});
        return p ? res.status(200).json(p) : res.status(404).json({ error: "Not found" });
      }
      if (req.method === "DELETE") return res.status(200).json({ ok: await db.deleteProduct(req.query.id) });
    }

    if (action === "orders") {
      if (req.method === "GET") return res.status(200).json(await db.getOrders());
      if (req.method === "PUT") {
        const valid = ["pending","confirmed","shipped","delivered","cancelled"];
        if (!valid.includes(req.body?.status)) return res.status(400).json({ error: "Bad status" });
        const o = await db.updateOrderStatus(req.query.id, req.body.status);
        return o ? res.status(200).json(o) : res.status(404).json({ error: "Not found" });
      }
    }

    if (action === "settings") {
      if (req.method === "GET") return res.status(200).json(await db.getSettings());
      if (req.method === "PUT") return res.status(200).json(await db.updateSettings(req.body || {}));
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
};
