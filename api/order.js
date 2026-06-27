const db = require("../lib/db");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await db.ensureSeed();
    const { items, customer, shipping, payment } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Cart is empty" });
    if (!customer || !customer.name || !customer.phone || !customer.address || !customer.city)
      return res.status(400).json({ error: "Please complete all delivery fields" });
    const order = await db.createOrder({ items, customer, shipping, payment });
    if (order.error) return res.status(400).json(order);
    return res.status(200).json({ ok: true, number: order.number, total: order.total });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
};
