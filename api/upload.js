const auth = require("../lib/auth");

// Receives a (browser-compressed) image as a base64 data URL and stores it on
// Vercel Blob, returning the public URL. Admin-gated.
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!auth.getAuth(req)) return res.status(401).json({ error: "Not authenticated" });

    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") return res.status(400).json({ error: "No image data" });
    const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/);
    if (!m) return res.status(400).json({ error: "Unsupported image format" });
    const contentType = m[1];
    const buffer = Buffer.from(m[3], "base64");
    if (buffer.length > 6 * 1024 * 1024) return res.status(413).json({ error: "Image too large after compression" });

    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(501).json({ error: "Image storage not connected. Connect Vercel Blob to this project." });

    const { put } = require("@vercel/blob");
    const ext = contentType.split("/")[1].replace("jpeg", "jpg");
    const safe = String(filename || "image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
    const blob = await put(`products/${safe}.${ext}`, buffer, { access: "public", contentType, addRandomSuffix: true });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: "Upload failed", detail: String(e.message || e) });
  }
};
