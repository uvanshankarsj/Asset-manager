// Drives the real app in Edge with a throwaway account and dummy data, then deletes it all.
// Needs the backend (3001) and frontend (5173) running, plus Microsoft Edge (or set EDGE_PATH).
// Run from the project root: npm run test:ui
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..");
// Screenshots go to a temp folder unless SHOTS_DIR is set
const SHOTS = process.env.SHOTS_DIR || path.join(os.tmpdir(), "expensio-ui-shots");
mkdirSync(SHOTS, { recursive: true });
const API = process.env.API_URL ?? "http://localhost:3001";
const APP = process.env.APP_URL ?? "http://localhost:5173";
const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const requireBackend = createRequire(path.join(ROOT, "backed", "package.json"));
const mongoose = requireBackend("mongoose");
requireBackend("dotenv").config({ path: path.join(ROOT, "backed", ".env"), quiet: true });
const dbConfig = requireBackend("./db-config.js");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
};
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EMAIL = `ui_test_${Date.now()}@example.test`;
let token = "";
let userId = "";

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !(body instanceof FormData) && { "Content-Type": "application/json" }) },
    body: body instanceof FormData ? body : body && JSON.stringify(body),
  });
  return res.json().catch(() => null);
}
const form = (o) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.append(k, String(v)));
  return f;
};

async function seed() {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dummy Tester", email: EMAIL, password: "dummy-pass-123" }),
  });
  const data = await res.json();
  token = data.token;
  userId = data.user.id;
  const post = (o) => api("POST", "/api/expenses", form(o));
  await post({ category: "FD", subject: "Dummy FD matured", date: iso(-400), amount: 100000, maturityDate: iso(-2) });
  await post({ category: "FD", subject: "Dummy FD future", date: iso(-10), amount: 50000, maturityDate: iso(200) });
  await post({ category: "Mutual Funds", subject: "Dummy SIP due", date: iso(-60), amount: 5000, nextSipDate: iso(-1) });
  await post({ category: "Mutual Funds", subject: "Dummy SIP later", date: iso(-5), amount: 2500, nextSipDate: iso(20) });
  await post({ category: "share", subject: "Dummy Shares A", symbol: "ZZDUMMY.NS", quantity: 10, pricePerShare: 250, date: iso(-30) });
  await post({ category: "share", subject: "Dummy Shares B", quantity: 5, pricePerShare: 99.5, date: iso(-20) });
  await post({ category: "Other", subject: "Dummy lunch", amount: 450, date: iso(-1) });
  for (const [name, price, d] of [["Dummy Laptop", 85000, -300], ["Dummy Phone", 40000, -120], ["Dummy Desk", 12000, -50]]) {
    await api("POST", "/api/assets", form({ name, price, purchaseDate: iso(d) }));
  }
}

async function cleanup() {
  try {
    await mongoose.connect(dbConfig.getMongoUri(), dbConfig.getConnectOptions());
    const db = mongoose.connection.db;
    const owner = new mongoose.Types.ObjectId(userId);
    const out = {};
    for (const c of ["transactions", "assets", "activities"]) out[c] = (await db.collection(c).deleteMany({ userId: owner })).deletedCount;
    out.users = (await db.collection("authusers").deleteMany({ email: EMAIL })).deletedCount;
    console.log("cleanup removed:", JSON.stringify(out));
  } finally {
    await mongoose.disconnect();
  }
}

// ---- page helpers ----
const fill = (page, sel, value) =>
  page.$eval(
    sel,
    (el, v) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    },
    value
  );
const clickText = (page, scope, text) =>
  page.evaluate(
    (scope, text) => {
      const el = [...document.querySelectorAll(scope)].find((e) => e.textContent.trim() === text);
      if (!el) return false;
      el.click();
      return true;
    },
    scope,
    text
  );
const text = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));
const waitText = (page, sel, needle, timeout = 8000) =>
  page.waitForFunction(
    (sel, needle) => [...document.querySelectorAll(sel)].some((e) => e.textContent.includes(needle)),
    { timeout },
    sel,
    needle
  );
const gotoTab = async (page, tab) => {
  await clickText(page, ".app-sidebar li", tab);
  await sleep(600);
};
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + ".png") });

async function newPage(browser, viewport, withToken = true) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => console.log("  [page error]", e.message));
  if (withToken) await page.evaluateOnNewDocument((t) => localStorage.setItem("authToken", t), token);
  else await page.evaluateOnNewDocument(() => localStorage.removeItem("authToken"));
  await page.goto(APP, { waitUntil: "networkidle0" });
  return page;
}

async function main() {
  await seed();
  console.log("seeded dummy data for", EMAIL);
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });

  try {
    // ============ DESKTOP ============
    const page = await newPage(browser, { width: 1366, height: 768 });
    await page.waitForSelector(".app-sidebar");
    check("logged in with saved token shows the app", (await text(page, ".app-sidebar h4"))[0] === "Dummy Tester");
    check("sidebar initial shown when no photo", (await text(page, ".app-sidebar [aria-label='profile image']"))[0] === "D");

    // layout
    const sb = await page.$eval(".app-sidebar", (e) => e.getBoundingClientRect().width);
    check("sidebar is ~18% wide on desktop", Math.abs(sb / 1366 - 0.18) < 0.01, `${sb}px`);
    const cardWidth = {};
    for (const tab of ["Home", "Expenses", "Assets", "Investments"]) {
      await gotoTab(page, tab);
      cardWidth[tab] = await page.$eval(".page-card", (e) => Math.round(e.getBoundingClientRect().width));
      check(`${tab}: no horizontal overflow on desktop`, (await overflowX(page)) <= 0, String(await overflowX(page)));
      await shot(page, `desktop-${tab}`);
    }
    const widths = Object.values(cardWidth);
    check("Home card is as wide as the other pages", Math.max(...widths) - Math.min(...widths) <= 2, JSON.stringify(cardWidth));

    // home content from dummy data
    await gotoTab(page, "Home");
    await waitText(page, ".home-panel li", "Dummy");
    const pending = (await text(page, ".home-panel:nth-child(1) li")).join(" | ");
    check("Home pending actions list the matured FD and due SIP", pending.includes("Dummy FD matured") && pending.includes("Dummy SIP due"), pending);

    // Home: mark SIP paid -> success toast
    await clickText(page, ".home-panel button", "Mark paid");
    await waitText(page, ".toast-item", "SIP marked as paid");
    check("Home: marking a SIP paid shows a success toast", true);
    await clickText(page, ".home-panel button", "Delete");
    await waitText(page, ".toast-item", "FD record deleted");
    check("Home: deleting a matured FD shows a success toast", true);

    // ---- Assets ----
    await gotoTab(page, "Assets");
    await waitText(page, "td", "Dummy Laptop");
    check("Assets lists the 3 dummy assets", (await text(page, "tbody tr")).filter((t) => t.startsWith("Dummy")).length === 3);

    await clickText(page, "button[type=submit]", "Add");
    await sleep(300);
    const emptyErr = (await text(page, ".form-errors li")).join(" | ");
    check("Assets: empty submit shows all three errors", /product name/i.test(emptyErr) && /price/i.test(emptyErr) && /purchase date/i.test(emptyErr), emptyErr);
    check("Assets: invalid fields are highlighted", (await page.$$("[aria-invalid='true']")).length === 3);

    await fill(page, "input[aria-label='Product name']", "Dummy Monitor");
    await fill(page, "input[aria-label='Price']", "-5");
    await fill(page, "input[aria-label='Purchase date']", iso(-1));
    await clickText(page, "button[type=submit]", "Add");
    await sleep(300);
    check("Assets: negative price rejected", (await text(page, ".form-errors li")).some((t) => /price must be 0 or more/i.test(t)));

    await fill(page, "input[aria-label='Price']", "15000");
    await clickText(page, "button[type=submit]", "Add");
    await waitText(page, ".toast-item", "Asset added");
    await waitText(page, "td", "Dummy Monitor");
    check("Assets: valid add shows toast and the new row", true);
    check("Assets: errors cleared after a good submit", (await page.$$(".form-errors")).length === 0);

    // edit
    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Dummy Monitor")).querySelector("button").click());
    await page.waitForSelector("[role=dialog]");
    check("Assets: Edit opens a dialog prefilled", (await page.$eval("[role=dialog] input", (e) => e.value)) === "Dummy Monitor");
    await shot(page, "desktop-assets-edit");
    await fill(page, "[role=dialog] input[type=number]", "-1");
    await clickText(page, "[role=dialog] button", "Save");
    await sleep(300);
    check("Assets: edit dialog validates too", (await text(page, "[role=dialog] .form-errors li")).length === 1);
    await fill(page, "[role=dialog] input[type=number]", "17500");
    await clickText(page, "[role=dialog] button", "Save");
    await waitText(page, ".toast-item", "Asset updated");
    await waitText(page, "td", "17,500");
    check("Assets: editing saves the new price", true);

    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Dummy Monitor")).querySelectorAll("button")[1].click());
    await waitText(page, ".toast-item", "Asset deleted");
    check("Assets: delete shows a toast and removes the row", !(await text(page, "td")).includes("Dummy Monitor"));

    // ---- Investments ----
    await gotoTab(page, "Investments");
    await waitText(page, "td", "Dummy FD future");
    const holdings = (await text(page, "tbody tr td:first-child")).filter((t) => t.startsWith("Dummy"));
    check("Investments lists dummy holdings (instalments folded in)", holdings.length >= 5 && !holdings.some((h) => h.includes("instalment")), holdings.join(", "));
    check("Investments: share profit/loss column gracefully shows dash without a live price", (await text(page, "tbody tr")).some((t) => t.startsWith("Dummy Shares B") && t.includes("—")));

    await clickText(page, "button[type=submit]", "Add");
    await sleep(300);
    const invErr = (await text(page, ".form-errors li")).join(" | ");
    check("Investments: empty submit shows name/type/amount/date errors", /name/i.test(invErr) && /type/i.test(invErr) && /amount/i.test(invErr) && /start date/i.test(invErr), invErr);

    await fill(page, "input[aria-label='Name']", "Dummy FD ui");
    await fill(page, "select[aria-label='Type']", "FD");
    await fill(page, "input[aria-label='Amount']", "20000");
    await fill(page, "input[title='Start / purchase date']", iso(0));
    await fill(page, "input[title='Maturity date']", iso(-5));
    await clickText(page, "button[type=submit]", "Add");
    await sleep(300);
    check("Investments: maturity before start is rejected", (await text(page, ".form-errors li")).some((t) => /after the start date/i.test(t)));
    await fill(page, "input[title='Maturity date']", iso(90));
    await clickText(page, "button[type=submit]", "Add");
    await waitText(page, ".toast-item", "Investment added");
    await waitText(page, "td", "Dummy FD ui");
    check("Investments: valid FD is added with a toast", true);

    // share needs quantity + price
    await fill(page, "input[aria-label='Name']", "Dummy Shares C");
    await fill(page, "select[aria-label='Type']", "share");
    await fill(page, "input[title='Start / purchase date']", iso(0));
    await clickText(page, "button[type=submit]", "Add");
    await sleep(300);
    const shErr = (await text(page, ".form-errors li")).join(" | ");
    check("Investments: share asks for quantity and price", /shares/i.test(shErr) && /price per share/i.test(shErr), shErr);
    await fill(page, "select[aria-label='Type']", "FD"); // reset to a simple type

    // edit an FD
    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Dummy FD ui")).querySelector("button").click());
    await page.waitForSelector("[role=dialog]");
    await shot(page, "desktop-investments-edit");
    await fill(page, "[role=dialog] input[type=number]", "0");
    await clickText(page, "[role=dialog] button", "Save");
    await sleep(300);
    check("Investments: edit rejects a zero amount", (await text(page, "[role=dialog] .form-errors li")).some((t) => /more than 0/i.test(t)));
    await fill(page, "[role=dialog] input[type=number]", "25000");
    await clickText(page, "[role=dialog] button", "Save");
    await waitText(page, ".toast-item", "Investment updated");
    await waitText(page, "td", "25,000");
    check("Investments: edit saves the new amount", true);

    // edit a share lot (qty x price recomputed)
    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Dummy Shares B")).querySelector("button").click());
    await page.waitForSelector("[role=dialog]");
    await fill(page, "[role=dialog] input[type=number]", "10");
    await clickText(page, "[role=dialog] button", "Save");
    await waitText(page, ".toast-item", "Investment updated");
    await waitText(page, "td", "995"); // 10 x 99.5
    check("Investments: editing share quantity recomputes the invested amount (10 x 99.5 = 995)", true);

    // delete
    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Dummy FD ui")).querySelectorAll("button")[1].click());
    await waitText(page, ".toast-item", "FD closed");
    check("Investments: closing an FD shows a toast", true);

    // ---- Expenses ----
    await gotoTab(page, "Expenses");
    await page.waitForSelector("form");
    await clickText(page, "button[type=submit]", "Save");
    await sleep(300);
    check("Expenses: empty submit shows errors", (await text(page, ".form-errors li")).length >= 3);
    await fill(page, "#subject", "Dummy coffee");
    await fill(page, "#date", iso(0));
    await fill(page, "#amount", "120");
    await fill(page, "#category", "Other");
    await clickText(page, "button[type=submit]", "Save");
    await waitText(page, ".toast-item", "Saved");
    check("Expenses: valid save shows a success toast and clears the form", (await page.$eval("#subject", (e) => e.value)) === "");

    // ---- profile photo ----
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    );
    const pngPath = path.join(os.tmpdir(), "expensio-test-photo.png");
    writeFileSync(pngPath, png);
    await (await page.$("input[type=file]")).uploadFile(pngPath);
    await page.waitForSelector(".app-sidebar img[alt='profile image']", { timeout: 8000 });
    check("Profile: uploading a photo replaces the initial", true);
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(".app-sidebar img[alt='profile image']");
    check("Profile: photo is still there after a reload (saved on the account)", true);
    await shot(page, "desktop-sidebar-photo");
    await clickText(page, ".app-sidebar button", "Remove");
    await page.waitForSelector(".app-sidebar div[aria-label='profile image']");
    check("Profile: Remove brings back the initial", true);

    // ---- logout / bad token ----
    await clickText(page, ".app-sidebar button", "Log out");
    await page.waitForSelector("#email");
    check("Logout returns to the login page", true);
    await shot(page, "desktop-login");
    await fill(page, "#email", EMAIL);
    await fill(page, "#password", "wrong-password");
    await page.click("button[type=submit]");
    await waitText(page, ".alert-danger", "Incorrect email or password");
    check("Login: wrong password shows the server's message", true);
    await fill(page, "#password", "dummy-pass-123");
    await page.click("button[type=submit]");
    await page.waitForSelector(".app-sidebar");
    check("Login: correct password gets back in", true);

    await page.evaluate(() => localStorage.setItem("authToken", "garbage"));
    await gotoTab(page, "Assets");
    await page.waitForSelector("#email", { timeout: 8000 });
    await waitText(page, ".toast-item", "session has expired");
    check("Expired/invalid token: kicked to login with a 'session expired' toast", true);
    await page.close();

    // ============ MOBILE ============
    const m = await newPage(browser, { width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.waitForSelector(".topbar");
    check("Mobile: top bar with menu button is visible", await m.$eval(".topbar", (e) => getComputedStyle(e).display !== "none"));
    check("Mobile: sidebar is hidden off-screen", await m.$eval(".app-sidebar", (e) => e.getBoundingClientRect().right <= 1));
    await shot(m, "mobile-home-closed");
    await m.click(".topbar button");
    await sleep(400);
    check("Mobile: menu button slides the sidebar in", await m.$eval(".app-sidebar", (e) => e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().width > 200));
    await shot(m, "mobile-menu-open");
    await clickText(m, ".app-sidebar li", "Investments");
    await sleep(500);
    check("Mobile: choosing a tab closes the menu and switches page", (await text(m, ".topbar span"))[0] === "Investments" && (await m.$eval(".app-sidebar", (e) => e.getBoundingClientRect().right <= 1)));

    for (const tab of ["Home", "Expenses", "Assets", "Investments"]) {
      await m.click(".topbar button");
      await sleep(300);
      await clickText(m, ".app-sidebar li", tab);
      await sleep(700);
      const over = await overflowX(m);
      check(`Mobile ${tab}: page doesn't scroll sideways`, over <= 1, `${over}px overflow`);
      await shot(m, `mobile-${tab}`);
    }

    await m.click(".topbar button");
    await sleep(300);
    await clickText(m, ".app-sidebar li", "Home");
    await sleep(700);
    const panels = await m.$$eval(".home-panel", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    check("Mobile Home: panels stack at full width", panels.length === 3 && panels.every((w) => w > 330), JSON.stringify(panels));
    const chartH = await m.$eval(".home-chart", (e) => Math.round(e.getBoundingClientRect().height));
    check("Mobile Home: chart has real height", chartH >= 250, `${chartH}px`);

    // mobile form usability: tap-add an asset
    await m.click(".topbar button");
    await sleep(300);
    await clickText(m, ".app-sidebar li", "Assets");
    await sleep(600);
    await fill(m, "input[aria-label='Product name']", "Dummy Mobile Item");
    await fill(m, "input[aria-label='Price']", "999");
    await fill(m, "input[aria-label='Purchase date']", iso(0));
    await clickText(m, "button[type=submit]", "Add");
    await waitText(m, ".toast-item", "Asset added");
    check("Mobile: adding an asset works and shows a toast", true);
    await shot(m, "mobile-assets-after-add");
    await m.close();

    // login page on mobile
    const lm = await newPage(browser, { width: 390, height: 844, isMobile: true }, false);
    await lm.waitForSelector("#email");
    check("Mobile login: fits the screen", (await overflowX(lm)) <= 1);
    await shot(lm, "mobile-login");
    await lm.close();
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (err) {
  check("script completed without throwing", false, err.message);
  console.log(err.stack);
} finally {
  await cleanup();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
