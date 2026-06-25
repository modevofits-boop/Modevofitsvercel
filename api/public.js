const db = require("../lib/db");
module.exports = async (req, res) => {
  try {
    await db.ensureSeed();
    const { type, slug } = req.query;
    if (type === "settings") return res.status(200).json(await db.getSettings());
    if (type === "product") {
      const p = await db.getProductBySlug(slug);
      if (!p || !p.active) return res.status(404).json({ error: "Not found" });
      return res.status(200).json(p);
    }
    if (type === "catalog") {
      return res.status(200).json({ products: (await db.getProducts()).filter(p => p.active), settings: await db.getSettings() });
    }
    return res.status(200).json((await db.getProducts()).filter(p => p.active));
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
};
