/* Data layer backed by Upstash Redis (Vercel Marketplace).
   In production it reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
   (injected automatically when you connect Upstash from the Vercel dashboard).
   A mock client can be injected via global.__MOCK_REDIS for local testing. */
const crypto = require("crypto");

let _client;
function redis() {
  if (_client) return _client;
  if (global.__MOCK_REDIS) { _client = global.__MOCK_REDIS; return _client; }
  const { Redis } = require("@upstash/redis");
  // Vercel's Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN.
  // Fall back to the classic UPSTASH_* names if those are present instead.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Redis credentials (connect Upstash to this project)");
  _client = new Redis({ url, token });
  return _client;
}

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const uid = () => crypto.randomBytes(6).toString("hex");

function seedProducts() {
  const C = { BLACK:{name:"Black",hex:"#1B1A17"}, STONE:{name:"Stone",hex:"#A9A29A"}, CREAM:{name:"Cream",hex:"#E2DAC8"}, CLAY:{name:"Desert Clay",hex:"#A98A72"}, IVORY:{name:"Ivory",hex:"#EAE5D8"}, SAGE:{name:"Sage",hex:"#9AA093"}, NAVY:{name:"Navy",hex:"#2B3140"}, OLIVE:{name:"Olive",hex:"#5B6043"}, CHAR:{name:"Charcoal",hex:"#3A3833"} };
  const SIZES = ["S","M","L","XL","XXL"];
  let n = 0;
  const mk = (name,category,type,price,compareAt,colors,desc,featured,stock=20)=>({id:"p"+(++n),slug:slugify(name),name,category,type,price,compareAt,colors,sizes:SIZES,desc,image:"",featured,stock,active:true});
  return [
    mk("Black Polo","Polo Shirts","polo",1999,3599,[C.BLACK,C.STONE],"Premium PQ piqué cotton at 280 GSM. Holds its shape, never sheer. A modern regular fit, true to size.",true),
    mk("Stone Polo","Polo Shirts","polo",1999,3499,[C.STONE,C.BLACK],"Muted stone piqué polo — quiet, versatile, built for everyday wear over anything.",true),
    mk("Olive Polo","Polo Shirts","polo",2099,3699,[C.OLIVE,C.BLACK],"A deep olive piqué polo with a structured collar that stays put wash after wash.",false),
    mk("Navy Polo","Polo Shirts","polo",2099,3699,[C.NAVY,C.STONE],"Classic navy in heavyweight piqué. The one you'll reach for without thinking.",false,6),
    mk("Black Tee","T-Shirts","tee",1499,2499,[C.BLACK,C.CREAM,C.CLAY],"The everyday tee in 280 GSM combed cotton. Double-needle stitching, structured collar that holds.",true),
    mk("Cream Tee","T-Shirts","tee",1499,2499,[C.CREAM,C.BLACK],"Warm cream in heavyweight cotton. Pre-shrunk, made to last well past the first wash.",true),
    mk("Desert Clay Tee","T-Shirts","tee",1499,2499,[C.CLAY,C.CREAM],"An earthy desert-clay tone in 280 GSM cotton. Modern regular fit, no clinging.",false),
    mk("Sage Tee","T-Shirts","tee",1499,2499,[C.SAGE,C.CREAM],"A calm sage green in premium cotton — pre-shrunk, and somehow already a favourite.",false,4),
    mk("Black Trouser","Trousers","trouser",2199,4399,[C.BLACK,C.STONE],"Heavyweight cotton-terry trouser with a clean tapered line. Reinforced seams, pre-shrunk.",true),
    mk("Ivory Trouser","Trousers","trouser",2199,4399,[C.IVORY,C.BLACK],"Soft ivory cotton-terry trouser. Clean break, reinforced stitching, an easy tailored look.",true),
    mk("Stone Trouser","Trousers","trouser",2299,4499,[C.STONE,C.CHAR],"A versatile stone trouser that bridges smart and casual without trying too hard.",false),
    mk("Charcoal Trouser","Trousers","trouser",2199,4399,[C.CHAR,C.BLACK],"Deep charcoal cotton-terry. Tapered, reinforced, and quietly sharp.",false,5),
  ];
}
const seedSettings = () => ({ storeName:"Modevofits", currency:"PKR", freeShippingThreshold:4000, shippingFee:200, expressFee:350, announcement:"Complimentary delivery over ₨ 4,000 — nationwide" });

async function ensureSeed() {
  const r = redis();
  const seeded = await r.get("mv:seeded");
  if (!seeded) {
    await r.set("mv:products", seedProducts());
    await r.set("mv:settings", seedSettings());
    await r.set("mv:orders", []);
    await r.set("mv:orderseq", 1000);
    await r.set("mv:seeded", true);
  }
}

const getProducts = async () => (await redis().get("mv:products")) || [];
const saveProducts = async (list) => { await redis().set("mv:products", list); };
const getProductBySlug = async (slug) => (await getProducts()).find((p) => p.slug === slug);
const getProduct = async (id) => (await getProducts()).find((p) => p.id === id);

async function createProduct(data) {
  const list = await getProducts();
  const prod = {
    id: "p" + uid(),
    slug: slugify(data.name || "product") + "-" + uid().slice(0, 4),
    name: data.name || "Untitled",
    category: data.category || "T-Shirts",
    type: data.type || "tee",
    price: Number(data.price) || 0,
    compareAt: Number(data.compareAt) || 0,
    stock: Number(data.stock) || 0,
    colors: Array.isArray(data.colors) ? data.colors : [],
    sizes: Array.isArray(data.sizes) && data.sizes.length ? data.sizes : ["S","M","L","XL","XXL"],
    desc: data.desc || data.description || "",
    image: data.image || "",
    featured: !!data.featured,
    active: data.active !== false,
  };
  list.unshift(prod);
  await saveProducts(list);
  return prod;
}
async function updateProduct(id, data) {
  const list = await getProducts();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  ["name","category","type","colors","sizes","desc","image","featured","active"].forEach((f) => { if (f in data) p[f] = data[f]; });
  if ("description" in data) p.desc = data.description;
  ["price","compareAt","stock"].forEach((f) => { if (f in data) p[f] = Number(data[f]) || 0; });
  await saveProducts(list);
  return p;
}
async function deleteProduct(id) {
  const list = await getProducts();
  const next = list.filter((x) => x.id !== id);
  await saveProducts(next);
  return next.length !== list.length;
}

const getSettings = async () => (await redis().get("mv:settings")) || seedSettings();
async function updateSettings(data) {
  const s = await getSettings();
  Object.assign(s, data);
  ["freeShippingThreshold","shippingFee","expressFee"].forEach((n) => { if (n in s) s[n] = Number(s[n]) || 0; });
  await redis().set("mv:settings", s);
  return s;
}

const getOrders = async () => (await redis().get("mv:orders")) || [];
async function createOrder({ items, customer, shipping, payment }) {
  const r = redis();
  const products = await getProducts();
  const clean = [];
  for (const it of items) {
    const prod = products.find((p) => p.id === it.productId);
    if (!prod || !prod.active) continue;
    clean.push({ productId: prod.id, name: prod.name, type: prod.type, color: it.color, hex: it.hex, size: it.size, price: prod.price, qty: Math.max(1, parseInt(it.qty) || 1) });
    prod.stock = Math.max(0, prod.stock - (parseInt(it.qty) || 1));
  }
  if (!clean.length) return { error: "No valid items" };
  const s = await getSettings();
  const subtotal = clean.reduce((sum, i) => sum + i.price * i.qty, 0);
  const ship = shipping === "express" ? s.expressFee : (subtotal >= s.freeShippingThreshold ? 0 : s.shippingFee);
  const seq = (await r.get("mv:orderseq")) || 1000;
  const number = "MV" + (Number(seq) + 1);
  const order = { id: uid(), number, items: clean, customer, payment: payment || "cod", shippingMethod: shipping || "standard", subtotal, shipping: ship, total: subtotal + ship, status: "pending", createdAt: Date.now() };
  const orders = await getOrders();
  orders.unshift(order);
  await r.set("mv:orders", orders);
  await r.set("mv:orderseq", Number(seq) + 1);
  await saveProducts(products);
  return order;
}
async function updateOrderStatus(id, status) {
  const orders = await getOrders();
  const o = orders.find((x) => x.id === id);
  if (!o) return null;
  o.status = status;
  await redis().set("mv:orders", orders);
  return o;
}

module.exports = { ensureSeed, getProducts, getProductBySlug, getProduct, createProduct, updateProduct, deleteProduct, getSettings, updateSettings, getOrders, createOrder, updateOrderStatus };
