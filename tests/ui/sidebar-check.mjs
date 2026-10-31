// Checks that Log out is always visible in the sidebar at many window sizes, then deletes its throwaway account.
// Needs the backend (3001) and frontend (5173) running, plus Microsoft Edge (or set EDGE_PATH).
// Run from the project root: npm run test:ui
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rb = createRequire(path.join(ROOT, "backed", "package.json"));
const mongoose = rb("mongoose");
rb("dotenv").config({ path: path.join(ROOT, "backed", ".env"), quiet: true });
const cfg = rb("./db-config.js");
const API = process.env.API_URL ?? "http://localhost:3001", APP = process.env.APP_URL ?? "http://localhost:5173";
const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const EMAIL = `sb_${Date.now()}@example.test`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const reg = await (await fetch(`${API}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Sidebar Tester", email: EMAIL, password: "dummy-pass-123" }) })).json();
const token = reg.token;
const fd = (o) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, String(v))); return f; };
for (let i = 0; i < 14; i++) await fetch(`${API}/api/expenses`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd({ category: "FD", subject: `Dummy FD ${i}`, date: iso(-50), amount: 1000 + i, maturityDate: iso(100 + i) }) });

const sizes = [[1920,1080],[1366,768],[1280,600],[1024,560],[1536,730],[1280,480],[820,1180],[768,1024],[390,844],[390,500],[360,640]];
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });
let bad = 0;
try {
  for (const [w, h] of sizes) {
    const mobile = w < 768;
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
    await page.evaluateOnNewDocument((t) => localStorage.setItem("authToken", t), token);
    await page.goto(APP, { waitUntil: "networkidle0" });
    await page.waitForSelector(".app-sidebar");
    if (mobile) { await page.click(".topbar button"); await sleep(400); }
    // after scrolling the sidebar to its end, the Log out button must be fully inside the window
    const r = await page.evaluate(async () => {
      const sb = document.querySelector(".app-sidebar");
      sb.scrollTop = sb.scrollHeight;
      await new Promise((r) => setTimeout(r, 100));
      const b = [...sb.querySelectorAll("button")].find((x) => x.textContent.trim() === "Log out").getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, vh: innerHeight, scrolls: sb.scrollHeight > sb.clientHeight + 1, needScroll: sb.scrollHeight - sb.clientHeight };
    });
    let ok = r.top >= 0 && r.bottom <= r.vh;
    // desktop: go to a long page, scroll the page down, Log out must still be visible (sidebar sticks)
    let sticky = "n/a";
    if (!mobile) {
      await page.evaluate(() => [...document.querySelectorAll(".app-sidebar li")].find((e) => e.textContent.trim() === "Investments").click());
      await sleep(900);
      await page.evaluate(() => { document.querySelector(".app-sidebar").scrollTop = 99999; window.scrollTo(0, document.documentElement.scrollHeight); });
      await sleep(200);
      const s = await page.evaluate(() => {
        const b = [...document.querySelectorAll(".app-sidebar button")].find((x) => x.textContent.trim() === "Log out").getBoundingClientRect();
        return { vis: b.top >= 0 && b.bottom <= innerHeight, pageScrolled: scrollY > 0 };
      });
      sticky = s.vis ? `ok${s.pageScrolled ? " (page scrolled)" : ""}` : "FAIL";
      ok = ok && s.vis;
    }
    if (!ok) bad++;
    console.log(`${ok ? "PASS" : "FAIL"} ${w}x${h}  logout ${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.vh}px  sidebar needs scroll: ${r.scrolls ? "yes (" + Math.round(r.needScroll) + "px)" : "no"}  sticky: ${sticky}`);
    if ([[1366,768],[1280,600],[390,500]].some(([a,b]) => a===w && b===h)) await page.screenshot({ path: path.join(os.tmpdir(), `expensio-sidebar-${w}x${h}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
  await mongoose.connect(cfg.getMongoUri(), cfg.getConnectOptions());
  const db = mongoose.connection.db;
  const u = await db.collection("authusers").findOne({ email: EMAIL });
  const out = {};
  for (const c of ["transactions", "assets", "activities"]) out[c] = (await db.collection(c).deleteMany({ userId: u._id })).deletedCount;
  out.users = (await db.collection("authusers").deleteMany({ email: EMAIL })).deletedCount;
  console.log("cleanup:", JSON.stringify(out));
  await mongoose.disconnect();
}
process.exit(bad ? 1 : 0);
