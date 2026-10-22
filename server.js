const express = require("express");
const puppeteer = require("puppeteer");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public", { etag: true, maxAge: "1h" }));

const TOKEN = process.env.MIRROR_TOKEN;
const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 3000);
const HOST = "0.0.0.0";

if (!TOKEN || TOKEN.length < 32) {
  console.error("Missing MIRROR_TOKEN. Set a random secret of at least 32 characters in the hosting panel.");
  process.exit(1);
}

let browser;
let page;

function authorized(req, res, next) {
  const supplied = req.get("authorization") || "";
  const expected = `Bearer ${TOKEN}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorized. Check your mirror token." });
  }
  next();
}
app.use("/api", authorized);

function getPage(res) {
  if (!page || page.isClosed()) {
    res.status(503).json({ error: "Browser is not ready. Check the deployment logs." });
    return false;
  }
  return true;
}

function validUrl(input) {
  try {
    const u = new URL(input);
    return (u.protocol === "https:" || u.protocol === "http:") &&
      !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(u.hostname);
  } catch {
    return false;
  }
}

app.get("/api/status", async (req, res) => {
  if (!getPage(res)) return;
  try {
    res.json({ title: await page.title(), url: page.url(), viewport: page.viewport() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/navigate", async (req, res) => {
  if (!getPage(res)) return;
  const url = String(req.body.url || "");
  if (!validUrl(url)) return res.status(400).json({ error: "Enter a valid public HTTP or HTTPS URL." });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    res.json({ title: await page.title(), url: page.url() });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/screenshot", async (req, res) => {
  if (!getPage(res)) return;
  try {
    const png = await page.screenshot({ type: "png", timeout: 15000 });
    res.type("png").set("Cache-Control", "no-store").send(png);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/click", async (req, res) => {
  if (!getPage(res)) return;
  const x = Number(req.body.x), y = Number(req.body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1280 || y > 800)
    return res.status(400).json({ error: "Invalid coordinates." });
  try { await page.mouse.click(x, y); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/type", async (req, res) => {
  if (!getPage(res)) return;
  const text = String(req.body.text || "").slice(0, 2000);
  try { await page.keyboard.type(text); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/key", async (req, res) => {
  if (!getPage(res)) return;
  const allowed = ["Enter", "Tab", "Escape", "Backspace", "ArrowUp", "ArrowDown",
    "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];
  if (!allowed.includes(req.body.key)) return res.status(400).json({ error: "Unsupported key." });
  try { await page.keyboard.press(req.body.key); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/scroll", async (req, res) => {
  if (!getPage(res)) return;
  const amount = Math.max(-1000, Math.min(1000, Number(req.body.amount) || 0));
  try { await page.mouse.wheel({ deltaY: amount }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/history", async (req, res) => {
  if (!getPage(res)) return;
  try {
    if (req.body.action === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    else if (req.body.action === "forward") await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    else if (req.body.action === "reload") await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    else return res.status(400).json({ error: "Invalid action." });
    res.json({ url: page.url(), title: await page.title() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

(async () => {
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    app.listen(PORT, HOST, () => console.log(`Browser mirror listening on ${HOST}:${PORT}`));
  } catch (e) {
    console.error("Could not start Chromium. Check memory and Chromium/Linux dependencies:", e);
    process.exit(1);
  }
})();

process.on("SIGINT", async () => {
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});
process.on("SIGTERM", async () => {
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});
