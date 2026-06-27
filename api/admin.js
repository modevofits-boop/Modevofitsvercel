const db = require("../lib/db");
const auth = require("../lib/auth");

function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }

module.exports = async (req, res) => {
  try {
    const action = req.query.action;

    // ---- login / logout ----
    if (action === "login") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const { username, password } = req.body || {};
      let session = null;
      if (auth.checkOwner(username, password)) session = { u: username, role: "owner" };
      else {
        await db.ensureSeed();
        const u = await db.verifyUser(username, password);
        if (u) session = { u: u.username, role: u.role };
      }
      if (!session) return res.status(401).json({ error: "Incorrect username or password" });
      auth.setAuthCookie(res, auth.sign(session));
      return res.status(200).json({ ok: true, role: session.role });
    }
    if (action === "logout") { auth.clearAuthCookie(res); return res.status(200).json({ ok: true }); }

    // ---- require auth ----
    const me = auth.getAuth(req);
    if (!me) return res.status(401).json({ error: "Not authenticated" });
    const isManager = me.role === "owner" || me.role === "admin";
    await db.ensureSeed();

    if (action === "me") return res.status(200).json({ username: me.u, role: me.role });

    if (action === "stats") {
      const orders = (await db.getOrders()).filter((o) => o.status !== "cancelled");
      const products = await db.getProducts();
      let revenue = 0, cost = 0;
      orders.forEach((o) => o.items.forEach((i) => { revenue += i.price * i.qty; cost += (i.cost || 0) * i.qty; }));
      const profit = revenue - cost;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
      // 30-day daily series
      const days = 30, series = [];
      const today = new Date(); today.setHours(0,0,0,0);
      const bucket = {};
      orders.forEach((o) => { const k = dayKey(o.createdAt); if (!bucket[k]) bucket[k] = { revenue: 0, orders: 0 }; bucket[k].revenue += o.total; bucket[k].orders += 1; });
      for (let i = days - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const k = dayKey(d.getTime()); series.push({ date: k, revenue: bucket[k]?.revenue || 0, orders: bucket[k]?.orders || 0 }); }
      // top products by units
      const units = {};
      orders.forEach((o) => o.items.forEach((i) => { units[i.name] = (units[i.name] || 0) + i.qty; }));
      const topProducts = Object.entries(units).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,qty])=>({name,qty}));
      const allOrders = await db.getOrders();
      return res.status(200).json({
        revenue, cost, profit, margin,
        orderCount: allOrders.length,
        pending: allOrders.filter((o) => o.status === "pending").length,
        productCount: products.length,
        lowStock: products.filter((p) => p.stock <= 5).length,
        recentOrders: allOrders.slice(0, 5),
        series, topProducts,
      });
    }

    if (action === "products") {
      if (req.method === "GET") return res.status(200).json(await db.getProducts());
      if (req.method === "POST") return res.status(200).json(await db.createProduct(req.body || {}));
      if (req.method === "PUT") { const p = await db.updateProduct(req.query.id, req.body || {}); return p ? res.status(200).json(p) : res.status(404).json({ error: "Not found" }); }
      if (req.method === "DELETE") return res.status(200).json({ ok: await db.deleteProduct(req.query.id) });
    }

    if (action === "categories") {
      if (req.method === "GET") return res.status(200).json(await db.getCategories());
      if (req.method === "POST") return res.status(200).json(await db.createCategory(req.body || {}));
      if (req.method === "PUT") { const c = await db.updateCategory(req.query.id, req.body || {}); return c ? res.status(200).json(c) : res.status(404).json({ error: "Not found" }); }
      if (req.method === "DELETE") return res.status(200).json({ ok: await db.deleteCategory(req.query.id) });
    }

    if (action === "orders") {
      if (req.method === "GET") return res.status(200).json(await db.getOrders());
      if (req.method === "PUT") {
        const valid = ["pending","confirmed","shipped","delivered","cancelled"];
        if (!valid.includes(req.body && req.body.status)) return res.status(400).json({ error: "Bad status" });
        const o = await db.updateOrderStatus(req.query.id, req.body.status);
        return o ? res.status(200).json(o) : res.status(404).json({ error: "Not found" });
      }
    }

    // ---- manager-only: users + settings ----
    if (action === "users") {
      if (!isManager) return res.status(403).json({ error: "Only admins can manage users" });
      if (req.method === "GET") return res.status(200).json(await db.getUsers());
      if (req.method === "POST") { const u = await db.createUser(req.body || {}); return u.error ? res.status(400).json(u) : res.status(200).json(u); }
      if (req.method === "PUT") { const u = await db.updateUser(req.query.id, req.body || {}); return u ? res.status(200).json(u) : res.status(404).json({ error: "Not found" }); }
      if (req.method === "DELETE") return res.status(200).json({ ok: await db.deleteUser(req.query.id) });
    }

    if (action === "settings") {
      if (req.method === "GET") return res.status(200).json(await db.getSettings());
      if (req.method === "PUT") { if (!isManager) return res.status(403).json({ error: "Only admins can change settings" }); return res.status(200).json(await db.updateSettings(req.body || {})); }
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
};
