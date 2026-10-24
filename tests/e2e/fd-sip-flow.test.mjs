// End-to-end test for the FD / SIP pending-action flow.
//
// Needs the backend (default http://localhost:3001) running against a database you
// are happy to write test records to. Test records are prefixed with "__test_<runId>"
// and removed afterwards. Time passing is simulated by moving dates in the database.
//
//   npm run test:e2e                      API checks only
//   SCREENSHOTS=1 npm run test:e2e        also saves UI screenshots (needs the Vite dev
//                                         server on :5173 and Microsoft Edge)
//
// Env: API_URL, FRONTEND_URL, EDGE_PATH
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "../../backed");
const requireBackend = createRequire(path.join(backendDir, "package.json"));
const mongoose = requireBackend("mongoose");
requireBackend("dotenv").config({ path: path.join(backendDir, ".env"), quiet: true });
const dbConfig = requireBackend("./db-config.js");

const API = process.env.API_URL ?? "http://localhost:3001";
const FRONTEND = process.env.FRONTEND_URL ?? "http://localhost:5173";
const EDGE =
  process.env.EDGE_PATH ??
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SCREENSHOTS = process.env.SCREENSHOTS === "1";
const SHOT_DIR = path.join(here, "screenshots");

const RUN = `__test_${Date.now().toString(36)}`;
const name = (s) => `${RUN}_${s}`;

// ---- date helpers (UTC, matching how the backend stores dates) ----
const iso = (d) => d.toISOString().slice(0, 10);
const dayFromToday = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
// Same rule as the backend: +1 month, clamped to the last day of the month
const addMonth = (date) => {
  const r = new Date(date);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + 1);
  const last = new Date(
    Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)
  ).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
};

// ---- API helpers ----
// The API needs a login, so the test signs up a throwaway user and removes it afterwards
const TEST_EMAIL = `${RUN.toLowerCase()}@example.test`;
let token = "";
const OTHER_EMAIL = `other_${TEST_EMAIL}`;
async function signUp(email = TEST_EMAIL) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: RUN, email, password: "test-password-123" }),
  });
  assert.equal(res.status, 201, "could not create the test user");
  return (await res.json()).token;
}
async function call(method, url, body, as = token) {
  const res = await fetch(`${API}${url}`, {
    method,
    body,
    headers: { Authorization: `Bearer ${as}` },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}
async function create(fields) {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => body.append(k, String(v)));
  const { status, json } = await call("POST", "/api/expenses", body);
  assert.equal(status, 201, `create ${fields.subject} failed: ${JSON.stringify(json)}`);
  return json.data._id;
}
const getJson = async (url) => (await call("GET", url)).json;
const mine = (list) => list.filter((x) => x.subject.startsWith(RUN));
const totals = async () =>
  Object.fromEntries(
    (await getJson("/api/getamount")).map((t) => [t._id, t.totalSpent])
  );

// ---- DB helpers (used only to simulate time passing and to clean up) ----
const col = (n) => mongoose.connection.collection(n);
const setDate = (recordId, field, date) =>
  col("transactions").updateOne(
    { _id: new mongoose.Types.ObjectId(recordId) },
    { $set: { [field]: date } }
  );
async function cleanup() {
  const filter = { subject: new RegExp(`^${RUN}`) };
  await col("transactions").deleteMany(filter);
  await col("activities").deleteMany(filter);
  await col("assets").deleteMany({ name: new RegExp(`^${RUN}`) });
  await col("authusers").deleteMany({ email: { $in: [TEST_EMAIL, OTHER_EMAIL, `edit_${OTHER_EMAIL}`] } });
}

async function shot(file) {
  if (!SCREENSHOTS) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  execFileSync(
    EDGE,
    [
      "--headless",
      "--disable-gpu",
      `--screenshot=${path.join(SHOT_DIR, file).replace(/\\/g, "/")}`,
      "--window-size=1280,800",
      "--virtual-time-budget=8000",
      FRONTEND,
    ],
    { stdio: "ignore", timeout: 60000 }
  );
  await sleep(1500); // let the file finish writing
}

describe("FD / SIP pending-action flow", () => {
  const id = {};
  let baseline;

  before(async () => {
    const reachable = await fetch(`${API}/api/message`).catch(() => null);
    assert.ok(
      reachable,
      `Backend not reachable at ${API}. Start it with: cd backed && npm start`
    );
    token = await signUp();

    const existing = await getJson("/api/pending-actions");
    assert.ok(
      existing.length <= 2,
      `Found ${existing.length} real pending actions. The list is capped at 5, so this ` +
        `test needs at most 2 existing ones. Use a test database.`
    );

    await mongoose.connect(dbConfig.getMongoUri(), dbConfig.getConnectOptions());
    baseline = await totals();
  });

  after(async () => {
    try {
      await cleanup();
    } finally {
      await mongoose.disconnect();
    }
  });

  describe("1. records created with future dates", () => {
    it("creates an FD (+2 days) and two SIPs (+1 and +5 days)", async () => {
      id.fd = await create({
        category: "FD",
        subject: name("FD"),
        date: iso(dayFromToday(0)),
        amount: 100000,
        maturityDate: iso(dayFromToday(2)),
      });
      id.sip = await create({
        category: "Mutual Funds",
        subject: name("SIP"),
        date: iso(dayFromToday(0)),
        amount: 5000,
        nextSipDate: iso(dayFromToday(1)),
      });
      id.late = await create({
        category: "Mutual Funds",
        subject: name("SIP_late"),
        date: iso(dayFromToday(-10)),
        amount: 3000,
        nextSipDate: iso(dayFromToday(5)),
      });
    });

    it("lists them in Pending Actions, soonest first", async () => {
      const list = mine(await getJson("/api/pending-actions"));
      assert.deepEqual(
        list.map((a) => [a.type, a.subject]),
        [
          ["SIP_DUE", name("SIP")],
          ["FD_MATURITY", name("FD")],
          ["SIP_DUE", name("SIP_late")],
        ]
      );
      await shot("01-created-upcoming.png");
    });

    it("logs 'New FD started' and 'SIP started' in Recent Transactions", async () => {
      const seen = mine(await getJson("/api/activity/recent")).map(
        (a) => `${a.type}:${a.subject}`
      );
      assert.ok(seen.includes(`NEW_FD:${name("FD")}`));
      assert.ok(seen.includes(`SIP_STARTED:${name("SIP")}`));
      assert.ok(seen.includes(`SIP_STARTED:${name("SIP_late")}`));
    });

    it("refuses Delete / Mark paid before the dates are reached", async () => {
      assert.equal((await call("DELETE", `/api/expenses/${id.fd}`)).status, 409);
      assert.equal((await call("POST", `/api/expenses/${id.sip}/sip-paid`)).status, 409);
      assert.equal((await call("POST", `/api/expenses/${id.late}/sip-paid`)).status, 409);
    });
  });

  describe("2. dates reached (simulated)", () => {
    before(async () => {
      await setDate(id.fd, "maturityDate", dayFromToday(-1)); // matured yesterday
      await setDate(id.sip, "nextSipDate", dayFromToday(0)); // due today
      await setDate(id.late, "nextSipDate", dayFromToday(-9)); // overdue
    });

    it("keeps due items in Pending Actions, oldest first", async () => {
      const list = mine(await getJson("/api/pending-actions"));
      assert.deepEqual(
        list.map((a) => a.subject),
        [name("SIP_late"), name("FD"), name("SIP")]
      );
      await shot("02-due-with-buttons.png");
    });

    it("Mark paid moves each SIP forward exactly one month", async () => {
      const a = await call("POST", `/api/expenses/${id.sip}/sip-paid`);
      assert.equal(a.status, 200);
      assert.equal(a.json.nextSipDate, addMonth(dayFromToday(0)).toISOString());

      const b = await call("POST", `/api/expenses/${id.late}/sip-paid`);
      assert.equal(b.status, 200);
      assert.equal(b.json.nextSipDate, addMonth(dayFromToday(-9)).toISOString());
    });

    it("Delete removes the matured FD", async () => {
      assert.equal((await call("DELETE", `/api/expenses/${id.fd}`)).status, 200);
    });

    it("repeating any action is refused (no double payment)", async () => {
      assert.equal((await call("POST", `/api/expenses/${id.sip}/sip-paid`)).status, 409);
      assert.equal((await call("POST", `/api/expenses/${id.late}/sip-paid`)).status, 409);
      assert.equal((await call("DELETE", `/api/expenses/${id.fd}`)).status, 409);
    });
  });

  describe("3. state after the actions", () => {
    it("Pending Actions shows only the SIPs, with their new dates", async () => {
      const list = mine(await getJson("/api/pending-actions"));
      const expected = [
        [name("SIP_late"), addMonth(dayFromToday(-9)).toISOString()],
        [name("SIP"), addMonth(dayFromToday(0)).toISOString()],
      ].sort((x, y) => x[1].localeCompare(y[1]));
      assert.deepEqual(
        list.map((a) => [a.subject, a.date]),
        expected
      );
      await shot("03-after-actions.png");
    });

    it("Recent Transactions records FD closed and both SIP payments", async () => {
      const acts = mine(await getJson("/api/activity/recent"));
      const find = (type, subject) =>
        acts.find((a) => a.type === type && a.subject === subject);
      assert.equal(find("FD_CLOSED", name("FD"))?.amount, 100000);
      assert.equal(find("SIP_PAID", name("SIP"))?.amount, 5000);
      assert.equal(find("SIP_PAID", name("SIP_late"))?.amount, 3000);
    });

    it("totals: Mutual Funds += initial + instalment for both SIPs; FD back to baseline", async () => {
      const now = await totals();
      assert.equal(
        (now["Mutual Funds"] ?? 0) - (baseline["Mutual Funds"] ?? 0),
        2 * (5000 + 3000)
      );
      assert.equal(now.FD ?? 0, baseline.FD ?? 0);
    });

    it("SIP instalment records never appear in Pending Actions", async () => {
      const list = mine(await getJson("/api/pending-actions"));
      assert.ok(list.every((a) => !a.subject.includes("(SIP instalment)")));
    });
  });

  describe("4. validation and limits", () => {
    it("rejects a malformed id with 400", async () => {
      assert.equal((await call("DELETE", "/api/expenses/not-an-id")).status, 400);
      assert.equal((await call("POST", "/api/expenses/not-an-id/sip-paid")).status, 400);
    });

    it("refuses to delete a record that is not an FD", async () => {
      const share = await create({
        category: "share",
        subject: name("share"),
        date: iso(dayFromToday(0)),
        amount: 10,
      });
      assert.equal((await call("DELETE", `/api/expenses/${share}`)).status, 409);
    });

    it("caps Pending Actions at 5 items", async () => {
      for (let i = 1; i <= 6; i++) {
        await create({
          category: "FD",
          subject: name(`cap${i}`),
          date: iso(dayFromToday(0)),
          amount: 1,
          maturityDate: iso(dayFromToday(30 + i)),
        });
      }
      assert.ok((await getJson("/api/pending-actions")).length <= 5);
    });
  });

  describe("5. each user only sees their own data", () => {
    let other;
    before(async () => {
      other = await signUp(OTHER_EMAIL);
    });

    it("hides the first user's records from another account", async () => {
      assert.equal(mine((await call("GET", "/api/investments", undefined, other)).json).length, 0);
      assert.equal(mine((await call("GET", "/api/activity/all", undefined, other)).json).length, 0);
      assert.ok(mine(await getJson("/api/investments")).length > 0);
    });

    it("stops another account from deleting or paying someone else's records", async () => {
      const fd = await create({
        category: "FD",
        subject: name("private_fd"),
        date: iso(dayFromToday(0)),
        amount: 1,
        maturityDate: iso(dayFromToday(30)),
      });
      assert.equal((await call("DELETE", `/api/investments/${fd}`, undefined, other)).status, 404);
      assert.equal((await call("DELETE", `/api/expenses/${fd}`, undefined, other)).status, 409);
      assert.equal((await call("POST", `/api/expenses/${id.sip}/sip-paid`, undefined, other)).status, 409);
      assert.ok(mine(await getJson("/api/investments")).some((x) => x._id === fd));
    });

    it("keeps assets private too", async () => {
      const body = new FormData();
      body.append("name", name("asset"));
      body.append("price", "100");
      body.append("purchaseDate", iso(dayFromToday(0)));
      assert.equal((await call("POST", "/api/assets", body)).status, 201);
      assert.equal(mine((await call("GET", "/api/assets", undefined, other)).json.map((a) => ({ subject: a.name }))).length, 0);
      assert.equal((await getJson("/api/assets")).filter((a) => a.name === name("asset")).length, 1);
      await col("assets").deleteMany({ name: name("asset") });
    });

    it("stores the profile picture on the account, and not on anyone else's", async () => {
      // 1x1 PNG
      const png =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const put = (as, avatar) =>
        fetch(`${API}/api/auth/avatar`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${as}` },
          body: JSON.stringify({ avatar }),
        });
      assert.equal((await put(token, "not an image")).status, 400);
      assert.equal((await put(token, png)).status, 200);
      const me = async (as) =>
        (await (await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${as}` } })).json()).user;
      assert.equal((await me(token)).avatar, png);
      assert.equal((await me(other)).avatar, null);
      const del = await fetch(`${API}/api/auth/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal((await del.json()).user.avatar, null);
    });
  });

  describe("6. editing records", () => {
    const put = (url, body, as = token) =>
      fetch(`${API}${url}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${as}` },
        body: JSON.stringify(body),
      }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }));
    const find = async (recordId) =>
      (await getJson("/api/investments")).find((x) => x._id === recordId);

    it("edits an FD's name, amount and maturity date", async () => {
      const fd = await create({
        category: "FD",
        subject: name("edit_fd"),
        date: iso(dayFromToday(0)),
        amount: 1000,
        maturityDate: iso(dayFromToday(30)),
      });
      const res = await put(`/api/investments/${fd}`, {
        subject: name("edit_fd2"),
        date: iso(dayFromToday(-1)),
        amount: "2500",
        maturityDate: iso(dayFromToday(60)),
      });
      assert.equal(res.status, 200);
      const row = await find(fd);
      assert.equal(row.subject, name("edit_fd2"));
      assert.equal(row.amount, 2500);
      assert.equal(row.maturityDate.slice(0, 10), iso(dayFromToday(60)));
      assert.equal(row.category, "FD");
    });

    it("recomputes a share's amount from quantity x price, and can clear the ticker", async () => {
      const share = await create({
        category: "share",
        subject: name("edit_share"),
        symbol: "ZZTEST.NS",
        quantity: 10,
        pricePerShare: 100,
        date: iso(dayFromToday(0)),
      });
      const res = await put(`/api/investments/${share}`, {
        subject: name("edit_share"),
        date: iso(dayFromToday(0)),
        quantity: "4",
        pricePerShare: "250.5",
        symbol: "",
      });
      assert.equal(res.status, 200);
      const row = await find(share);
      assert.equal(row.quantity, 4);
      assert.equal(row.pricePerShare, 250.5);
      assert.equal(row.amount, 1002);
      assert.equal(row.symbol, undefined);
    });

    it("renaming a SIP also renames its paid instalments", async () => {
      const sip = await create({
        category: "Mutual Funds",
        subject: name("edit_sip"),
        date: iso(dayFromToday(-40)),
        amount: 500,
        nextSipDate: iso(dayFromToday(-1)),
      });
      assert.equal((await call("POST", `/api/expenses/${sip}/sip-paid`)).status, 200);
      const res = await put(`/api/investments/${sip}`, {
        subject: name("edit_sip_renamed"),
        date: iso(dayFromToday(-40)),
        amount: "500",
        nextSipDate: iso(dayFromToday(20)),
      });
      assert.equal(res.status, 200);
      const subjects = mine(await getJson("/api/investments")).map((x) => x.subject);
      assert.ok(subjects.includes(`${name("edit_sip_renamed")} (SIP instalment)`));
      assert.ok(!subjects.includes(`${name("edit_sip")} (SIP instalment)`));
    });

    it("rejects bad values and unknown records", async () => {
      const fd = await create({
        category: "FD",
        subject: name("edit_bad"),
        date: iso(dayFromToday(0)),
        amount: 10,
        maturityDate: iso(dayFromToday(30)),
      });
      const ok = { subject: name("edit_bad"), date: iso(dayFromToday(0)), amount: "10" };
      assert.equal((await put(`/api/investments/${fd}`, { ...ok, amount: "-5" })).status, 400);
      assert.equal((await put(`/api/investments/${fd}`, { ...ok, subject: " " })).status, 400);
      assert.equal((await put(`/api/investments/${fd}`, { ...ok, date: "nonsense" })).status, 400);
      assert.equal((await put(`/api/investments/${fd}`, { subject: "x", date: ok.date })).status, 400);
      assert.equal((await put("/api/investments/not-an-id", ok)).status, 400);
      assert.equal((await find(fd)).amount, 10);
    });

    it("another account cannot edit your investment or asset", async () => {
      const other = await signUp(`edit_${OTHER_EMAIL}`);
      const fd = await create({
        category: "FD",
        subject: name("edit_private"),
        date: iso(dayFromToday(0)),
        amount: 10,
        maturityDate: iso(dayFromToday(30)),
      });
      const res = await put(
        `/api/investments/${fd}`,
        { subject: "hacked", date: iso(dayFromToday(0)), amount: "1" },
        other
      );
      assert.equal(res.status, 404);
      assert.equal((await find(fd)).subject, name("edit_private"));

      const body = new FormData();
      body.append("name", name("edit_asset"));
      body.append("price", "100");
      body.append("purchaseDate", iso(dayFromToday(0)));
      const assetId = (await call("POST", "/api/assets", body)).json.data._id;
      const asset = { name: name("edit_asset2"), price: "250", purchaseDate: iso(dayFromToday(-3)) };
      assert.equal((await put(`/api/assets/${assetId}`, asset, other)).status, 404);
      assert.equal((await put(`/api/assets/${assetId}`, asset)).status, 200);
      const saved = (await getJson("/api/assets")).find((a) => a._id === assetId);
      assert.equal(saved.name, name("edit_asset2"));
      assert.equal(saved.price, 250);
      assert.equal((await put(`/api/assets/${assetId}`, { ...asset, price: "-1" })).status, 400);
      await col("assets").deleteMany({ name: new RegExp(`^${RUN}`) });
    });
  });
});
