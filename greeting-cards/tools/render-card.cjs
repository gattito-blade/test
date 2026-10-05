// Render one card's faces to a PNG for visual checking.
// Usage: NODE_PATH=<dir with playwright> node tools/render-card.cjs <card-id> <out.png> [scale]
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const [id, out, scale = "2"] = process.argv.slice(2);
  if (!id || !out) { console.error("usage: render-card.cjs <card-id> <out.png> [scale]"); process.exit(2); }
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1000 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text()); });
  const url = "file://" + path.resolve(__dirname, "preview.html") + "?card=" + encodeURIComponent(id) + "&scale=" + scale;
  await page.goto(url);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
  const err = await page.textContent("#err");
  const timing = await page.textContent("#timing");
  await page.screenshot({ path: out, fullPage: true });
  console.log(timing || "");
  if (err) console.log("ERROR:\n" + err);
  if (logs.length) console.log(logs.join("\n"));
  await browser.close();
})();
