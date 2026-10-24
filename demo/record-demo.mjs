// Records a narrated walkthrough of the app in Edge using a throwaway account, then deletes the account.
// Needs the app running (npm start) and: npm install --no-save puppeteer-core ffmpeg-static
// Run from the project root: node demo/record-demo.mjs
import puppeteer from "puppeteer-core";
import ffmpegPath from "ffmpeg-static";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const OUT_DIR = here;
mkdirSync(OUT_DIR, { recursive: true });
const VIDEO = path.join(OUT_DIR, "expensio-demo.mp4");
const APP = "http://localhost:5173";
const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const requireBackend = createRequire(path.join(ROOT, "backed", "package.json"));
const mongoose = requireBackend("mongoose");
requireBackend("dotenv").config({ path: path.join(ROOT, "backed", ".env"), quiet: true });
const dbConfig = requireBackend("./db-config.js");

const EMAIL = `demo_${Date.now()}@example.test`;
const PASS = "demo-pass-123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const caption = (page, msg) =>
  page.evaluate((msg) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText =
        "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,.82);color:#fff;" +
        "padding:10px 22px;border-radius:10px;font:600 20px system-ui,sans-serif;max-width:90vw;text-align:center;pointer-events:none;";
      if (window.innerWidth < 600) el.style.cssText += "font-size:14px;padding:6px 12px;bottom:70px;width:84vw;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }, msg);

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
const typeInto = async (page, sel, value) => {
  await page.click(sel);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.type(sel, value, { delay: 55 });
};
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
const waitText = (page, sel, needle, timeout = 10000) =>
  page.waitForFunction((sel, needle) => [...document.querySelectorAll(sel)].some((e) => e.textContent.includes(needle)), { timeout }, sel, needle);
const tab = async (page, name) => {
  await clickText(page, ".app-sidebar li", name);
  await sleep(1200);
};
const rowButton = (page, rowText, index) =>
  page.evaluate(
    (rowText, index) => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes(rowText)).querySelectorAll("button")[index].click(),
    rowText,
    index
  );

async function cleanup() {
  try {
    await mongoose.connect(dbConfig.getMongoUri(), dbConfig.getConnectOptions());
    const db = mongoose.connection.db;
    const user = await db.collection("authusers").findOne({ email: EMAIL });
    if (!user) return console.log("cleanup: no demo user found");
    const out = {};
    for (const c of ["transactions", "assets", "activities"]) out[c] = (await db.collection(c).deleteMany({ userId: user._id })).deletedCount;
    out.users = (await db.collection("authusers").deleteMany({ email: EMAIL })).deletedCount;
    console.log("cleanup removed:", JSON.stringify(out));
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on("dialog", (d) => d.accept());
    await page.goto(APP, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.removeItem("authToken"));
    await page.reload({ waitUntil: "networkidle0" });
    const recorder = await page.screencast({ path: VIDEO, ffmpegPath, fps: 20 });

    // 1. sign up
    await caption(page, "Expensio: track investments, assets and expenses");
    await sleep(2500);
    await clickText(page, "button", "New here? Create an account");
    await caption(page, "1. Create an account (passwords are hashed, each account sees only its own data)");
    await typeInto(page, "#name", "Demo User");
    await typeInto(page, "#email", EMAIL);
    await typeInto(page, "#password", PASS);
    await sleep(600);
    await page.click("button[type=submit]");
    await page.waitForSelector(".app-sidebar");
    await sleep(800);
    await caption(page, "Signed in. An empty account starts clean");
    await sleep(2500);

    // 2. add records through Expenses
    await tab(page, "Expenses");
    await caption(page, "2. Validation: submitting an empty form shows what is missing");
    await clickText(page, "button[type=submit]", "Save");
    await sleep(2500);

    const addExpense = async (v) => {
      await typeInto(page, "#subject", v.subject);
      await fill(page, "#date", v.date);
      await typeInto(page, "#amount", String(v.amount));
      await fill(page, "#category", v.category);
      if (v.maturityDate) await fill(page, "#maturityDate", v.maturityDate);
      if (v.nextSipDate) await fill(page, "#nextSipDate", v.nextSipDate);
      await sleep(500);
      await clickText(page, "button[type=submit]", "Save");
      await waitText(page, ".toast-item", "Saved");
      await sleep(1200);
    };
    await caption(page, "3. Add a fixed deposit that has already matured");
    await addExpense({ subject: "HDFC Fixed Deposit", date: iso(-400), amount: 100000, category: "FD", maturityDate: iso(-2) });
    await caption(page, "4. Add a mutual fund with a SIP that is due");
    await addExpense({ subject: "Index Fund SIP", date: iso(-60), amount: 5000, category: "Mutual Funds", nextSipDate: iso(-1) });
    await caption(page, "5. Add a future FD and a regular expense");
    await addExpense({ subject: "SBI Fixed Deposit", date: iso(-10), amount: 50000, category: "FD", maturityDate: iso(300) });
    await addExpense({ subject: "Groceries", date: iso(0), amount: 2400, category: "Other" });

    // 3. home
    await tab(page, "Home");
    await caption(page, "6. Home: matured FDs and due SIPs need your attention, plus recent activity and a chart");
    await sleep(4500);
    await caption(page, "Mark the SIP as paid: its next date moves forward a month");
    await clickText(page, ".home-panel button", "Mark paid");
    await waitText(page, ".toast-item", "SIP marked as paid");
    await sleep(2500);
    await caption(page, "Delete the matured FD to close it out");
    await clickText(page, ".home-panel button", "Delete");
    await waitText(page, ".toast-item", "FD record deleted");
    await sleep(3000);

    // 4. investments + edit
    await tab(page, "Investments");
    await caption(page, "7. Investments: every holding in one table");
    await sleep(3000);
    await caption(page, "Add a share holding (quantity x average price)");
    await typeInto(page, "input[aria-label='Name']", "Reliance Industries");
    await fill(page, "select[aria-label='Type']", "share");
    await sleep(600);
    const qty = await page.$("input[placeholder='No. of shares']");
    if (qty) await typeInto(page, "input[placeholder='No. of shares']", "12");
    const price = await page.$("input[placeholder='Price per share']");
    if (price) await typeInto(page, "input[placeholder='Price per share']", "1450");
    await fill(page, "input[title='Start / purchase date']", iso(-20));
    await sleep(600);
    await clickText(page, "button[type=submit]", "Add");
    await waitText(page, ".toast-item", "Investment added");
    await sleep(2500);
    await caption(page, "8. Edit any record from a dialog");
    await rowButton(page, "SBI Fixed Deposit", 0);
    await page.waitForSelector("[role=dialog]");
    await sleep(2000);
    await fill(page, "[role=dialog] input[type=number]", "0");
    await clickText(page, "[role=dialog] button", "Save");
    await caption(page, "The dialog validates too: the amount must be above zero");
    await sleep(2500);
    await fill(page, "[role=dialog] input[type=number]", "65000");
    await clickText(page, "[role=dialog] button", "Save");
    await waitText(page, ".toast-item", "Investment updated");
    await sleep(3000);

    // 5. assets
    await tab(page, "Assets");
    await caption(page, "9. Assets: keep track of what you own");
    await typeInto(page, "input[aria-label='Product name']", "MacBook Air");
    await typeInto(page, "input[aria-label='Price']", "95000");
    await fill(page, "input[aria-label='Purchase date']", iso(-120));
    await sleep(600);
    await clickText(page, "button[type=submit]", "Add");
    await waitText(page, ".toast-item", "Asset added");
    await sleep(2500);
    await typeInto(page, "input[aria-label='Product name']", "Office Chair");
    await typeInto(page, "input[aria-label='Price']", "12000");
    await fill(page, "input[aria-label='Purchase date']", iso(-40));
    await clickText(page, "button[type=submit]", "Add");
    await waitText(page, ".toast-item", "Asset added");
    await sleep(2500);
    await caption(page, "Edit an asset's price");
    await rowButton(page, "Office Chair", 0);
    await page.waitForSelector("[role=dialog]");
    await sleep(1500);
    await fill(page, "[role=dialog] input[type=number]", "10500");
    await clickText(page, "[role=dialog] button", "Save");
    await waitText(page, ".toast-item", "Asset updated");
    await sleep(2500);

    // 6. profile photo
    await caption(page, "10. Profile picture: it is saved to your account");
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 200;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 200, 200);
      grad.addColorStop(0, "#4f46e5");
      grad.addColorStop(1, "#06b6d4");
      g.fillStyle = grad;
      g.fillRect(0, 0, 200, 200);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(100, 78, 36, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(100, 190, 62, Math.PI, 0);
      g.fill();
      return c.toDataURL("image/png").split(",")[1];
    });
    const photo = path.join(os.tmpdir(), "demo-photo.png");
    writeFileSync(photo, Buffer.from(png, "base64"));
    await sleep(1500);
    await (await page.$("input[type=file]")).uploadFile(photo);
    await page.waitForSelector(".app-sidebar img[alt='profile image']", { timeout: 10000 });
    await sleep(3000);

    // 7. logout / login
    await caption(page, "11. Log out and back in: the data and photo follow the account");
    await clickText(page, ".app-sidebar button", "Log out");
    await page.waitForSelector("#email");
    await sleep(1500);
    await typeInto(page, "#email", EMAIL);
    await typeInto(page, "#password", "wrong-password");
    await page.click("button[type=submit]");
    await waitText(page, ".alert-danger", "Incorrect email or password");
    await caption(page, "A wrong password shows a clear error");
    await sleep(2500);
    await typeInto(page, "#password", PASS);
    await page.click("button[type=submit]");
    await page.waitForSelector(".app-sidebar", { timeout: 10000 }).catch(async () => {
      await page.screenshot({ path: path.join(os.tmpdir(), "demo-debug.png") });
      console.log("DEBUG body:", await page.evaluate(() => document.body.innerText.slice(0, 300)));
    });
    await page.waitForSelector(".app-sidebar img[alt='profile image']", { timeout: 10000 }).catch(async () => {
      await page.screenshot({ path: path.join(os.tmpdir(), "demo-debug.png") });
      console.log("DEBUG sidebar:", await page.evaluate(() => document.querySelector(".app-sidebar")?.innerHTML.slice(0, 600)));
      throw new Error("no photo after login");
    });
    await sleep(3000);

    // 8. mobile view
    await caption(page, "12. Responsive phone layout");
    await sleep(2000);
    await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(".topbar");
    await caption(page, "Menu slides in on mobile");
    await sleep(3000);
    await page.click(".topbar button");
    await sleep(2500);
    await clickText(page, ".app-sidebar li", "Investments");
    await sleep(3000);
    await page.click(".topbar button");
    await sleep(800);
    await clickText(page, ".app-sidebar li", "Home");
    await sleep(3500);
    await caption(page, "Thanks for watching");
    await sleep(2500);

    await recorder.stop();
    await page.close();
  } finally {
    await browser.close();
  }
}

try {
  await main();
  console.log("video saved:", VIDEO);
} catch (e) {
  console.log("FAILED:", e.stack);
  process.exitCode = 1;
} finally {
  await cleanup();
}
