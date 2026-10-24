import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createExpense,
  deleteInvestment,
  fetchAllActivity,
  fetchInvestments,
  fetchSharePrices,
  type ShareQuote,
  type Investment,
  type RecentActivity,
} from "../../api";
import TickerInput from "./TickerInput";
import EditInvestment from "./EditInvestment";
import FormErrors from "../FormErrors";
import { useToast } from "../Toast";
import { validateInvestment, type Errors } from "../../validation";

const FILTERS = ["All", "FD", "Mutual Funds", "share"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  All: "All",
  FD: "FD",
  "Mutual Funds": "Mutual Funds",
  share: "Shares",
};
const SIP_SUFFIX = " (SIP instalment)";
const UPCOMING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVITY_LABEL: Record<RecentActivity["type"], string> = {
  NEW_FD: "New FD started",
  SIP_STARTED: "SIP started",
  FD_CLOSED: "FD closed",
  SIP_PAID: "SIP paid",
  ADDED: "Investment added",
};

const fieldStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  colorScheme: "dark",
  color: "rgb(205, 201, 200)",
};

const EMPTY = {
  subject: "",
  symbol: "",
  category: "",
  amount: "",
  quantity: "",
  pricePerShare: "",
  date: "",
  maturityDate: "",
  nextSipDate: "",
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const formatAmount = (n: number) => n.toLocaleString("en-IN");
const daysUntil = (d: string) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / DAY_MS);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section style={{ marginBottom: "30px" }}>
    <h4>{title}</h4>
    {children}
  </section>
);

const Investments: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [prices, setPrices] = useState<Record<string, ShareQuote>>({});
  const [pricesFailed, setPricesFailed] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);

  const load = useCallback(() => {
    // Live prices come from an external API, so don't make the list wait for them
    fetchSharePrices()
      .then((p) => {
        setPrices(p);
        setPricesFailed(false);
      })
      .catch(() => setPricesFailed(true));
    return Promise.all([fetchInvestments(), fetchAllActivity()])
      .then(([inv, act]) => {
        setInvestments(inv);
        setActivity(act);
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // SIP instalments are stored as separate rows; fold them into their parent SIP
  const { holdings, instalments } = useMemo(() => {
    const paid = new Map<string, { count: number; total: number }>();
    const rows: Investment[] = [];
    for (const inv of investments) {
      if (inv.subject.endsWith(SIP_SUFFIX)) {
        const parent = inv.subject.slice(0, -SIP_SUFFIX.length);
        const p = paid.get(parent) ?? { count: 0, total: 0 };
        paid.set(parent, { count: p.count + 1, total: p.total + inv.amount });
      } else {
        rows.push(inv);
      }
    }
    return { holdings: rows, instalments: paid };
  }, [investments]);

  const allocation = useMemo(() => {
    const totals = new Map<string, number>();
    for (const inv of investments)
      totals.set(inv.category, (totals.get(inv.category) ?? 0) + inv.amount);
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return {
      sum,
      rows: [...totals]
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    };
  }, [investments]);

  const upcoming = useMemo(
    () =>
      holdings
        .flatMap((h) => {
          const date = h.category === "FD" ? h.maturityDate : h.nextSipDate;
          if (!date || daysUntil(date) > UPCOMING_DAYS) return [];
          return [
            {
              ...h,
              date,
              label: h.category === "FD" ? "FD matures" : "SIP due",
            },
          ];
        })
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [holdings],
  );

  const visible = holdings.filter(
    (h) => filter === "All" || h.category === filter,
  );

  const details = (h: Investment) => {
    if (h.category === "FD" && h.maturityDate)
      return `Matures ${formatDate(h.maturityDate)} (${
        daysUntil(h.maturityDate) > 0
          ? `${daysUntil(h.maturityDate)} days left`
          : "matured"
      })`;
    if (h.category === "Mutual Funds" && h.nextSipDate) {
      const p = instalments.get(h.subject);
      return `Next SIP ${formatDate(h.nextSipDate)}${
        p ? ` · ${p.count} paid (${formatAmount(p.total)})` : ""
      }`;
    }
    if (h.category === "share") {
      const held = h.quantity
        ? `${formatAmount(h.quantity)} shares @ avg ${formatAmount(h.pricePerShare ?? 0)}`
        : "Quantity not recorded";
      if (!h.symbol) return `${held} · add a ticker for live price`;
      const quote = prices[h._id];
      if (quote)
        return `${held} · now ${quote.currency} ${formatAmount(quote.price)} (${h.symbol})`;
      return `${held} · ${pricesFailed ? "price unavailable" : "loading price…"}`;
    }
    return "—";
  };

  // Profit/loss needs both a quantity and a live price; otherwise it can't be worked out
  const profitLoss = (h: Investment) => {
    const quote = prices[h._id];
    if (h.category !== "share" || !h.quantity || !quote) return null;
    const value = quote.price * h.quantity;
    const diff = value - h.amount;
    return { value, diff, pct: h.amount ? (diff / h.amount) * 100 : 0 };
  };

  // The share the form would be added to (same ticker, or same name when no ticker is given)
  const mergeTarget =
    form.category === "share"
      ? holdings.find(
          (h) =>
            h.category === "share" &&
            h.quantity &&
            (form.symbol
              ? h.symbol === form.symbol.trim().toUpperCase()
              : h.subject.trim().toLowerCase() ===
                form.subject.trim().toLowerCase()),
        )
      : undefined;
  const lotCost = Number(form.quantity) * Number(form.pricePerShare);

  const set =
    (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateInvestment(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await createExpense({
        ...form,
        subject: form.subject.trim(),
        amount: form.category === "share" ? "" : form.amount,
        symbol: form.category === "share" ? form.symbol : "",
        quantity: form.category === "share" ? form.quantity : "",
        pricePerShare: form.category === "share" ? form.pricePerShare : "",
        maturityDate: form.category === "FD" ? form.maturityDate : "",
        nextSipDate: form.category === "Mutual Funds" ? form.nextSipDate : "",
      });
      setForm(EMPTY);
      await load();
      toast.success("Investment added.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Investment) => {
    const verb = h.category === "FD" ? "Close" : "Delete";
    if (!window.confirm(`${verb} "${h.subject}"?`)) return;
    try {
      await deleteInvestment(h._id);
      await load();
      toast.success(h.category === "FD" ? "FD closed." : "Investment deleted.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not delete. Please try again.",
      );
    }
  };

  return (
    <div
      className="page"
      style={{
        height: "100vh",
        backgroundColor: "rgb(40, 39, 39)",
        padding: "30px 30px 30px 0px",
      }}
    >
      <div
        className="page-card"
        style={{
          backgroundColor: "rgb(0, 0, 0)",
          height: "100%",
          color: "rgb(205, 201, 200)",
          borderRadius: "20px",
          padding: "3%",
          overflowY: "auto",
          textAlign: "left",
        }}
      >
        <h1>Investments</h1>
        <hr style={{ border: "1px solid white", margin: "10px 0 20px" }} />

        <Section title="Add investment">
          <form
            noValidate
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
          >
            <input
              placeholder="Name"
              value={form.subject}
              onChange={set("subject")}
              aria-label="Name"
              aria-invalid={!!errors.subject}
              style={{ ...fieldStyle, flex: 2, minWidth: "150px" }}
            />
            <select
              value={form.category}
              onChange={set("category")}
              aria-label="Type"
              aria-invalid={!!errors.category}
              style={{ ...fieldStyle, flex: 1 }}
            >
              <option value="" disabled>
                Type
              </option>
              <option value="FD">FD</option>
              <option value="Mutual Funds">Mutual Funds</option>
              <option value="share">Shares</option>
            </select>
            {form.category === "share" ? (
              <>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="No. of shares"
                  value={form.quantity}
                  onChange={set("quantity")}
                  aria-invalid={!!errors.quantity}
                  style={{ ...fieldStyle, flex: 1, minWidth: "110px" }}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Price per share"
                  value={form.pricePerShare}
                  onChange={set("pricePerShare")}
                  aria-invalid={!!errors.pricePerShare}
                  style={{ ...fieldStyle, flex: 1, minWidth: "120px" }}
                />
              </>
            ) : (
              <input
                type="number"
                min="0"
                placeholder="Amount"
                value={form.amount}
                onChange={set("amount")}
                aria-label="Amount"
                aria-invalid={!!errors.amount}
                style={{ ...fieldStyle, flex: 1, minWidth: "110px" }}
              />
            )}
            <input
              type="date"
              title="Start / purchase date"
              value={form.date}
              onChange={set("date")}
              aria-invalid={!!errors.date}
              style={{ ...fieldStyle, flex: 1 }}
            />
            {form.category === "share" && (
              <TickerInput
                value={form.symbol}
                onChange={(symbol) => setForm({ ...form, symbol })}
                onPick={(s) =>
                  setForm({
                    ...form,
                    symbol: s.symbol,
                    subject: form.subject || s.name,
                  })
                }
                style={fieldStyle}
              />
            )}
            {form.category === "FD" && (
              <input
                type="date"
                title="Maturity date"
                value={form.maturityDate}
                onChange={set("maturityDate")}
                aria-invalid={!!errors.maturityDate}
                style={{ ...fieldStyle, flex: 1 }}
              />
            )}
            {form.category === "Mutual Funds" && (
              <input
                type="date"
                title="Next SIP date"
                value={form.nextSipDate}
                onChange={set("nextSipDate")}
                aria-invalid={!!errors.nextSipDate}
                style={{ ...fieldStyle, flex: 1 }}
              />
            )}
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? "Adding..." : "Add"}
            </button>
          </form>
          <FormErrors errors={errors} />
          {form.category === "share" && lotCost > 0 && (
            <small style={{ display: "block" }}>
              This purchase: {formatAmount(lotCost)}.
              {mergeTarget &&
                ` Adds to your ${mergeTarget.subject} holding, averaging the price from ${formatAmount(mergeTarget.pricePerShare ?? 0)} to ${formatAmount(
                  Math.round(
                    ((mergeTarget.amount + lotCost) /
                      ((mergeTarget.quantity ?? 0) + Number(form.quantity))) *
                      100,
                  ) / 100,
                )}.`}
            </small>
          )}
          {form.category === "share" && (
            <small>
              Ticker is optional. Search by company name or symbol and pick a
              suggestion (.NS is NSE, .BO is BSE) to see the live price. Picking
              one also fills the Name if it is empty.
            </small>
          )}
          {form.category === "FD" && (
            <small>Date fields: start date, then maturity date.</small>
          )}
          {form.category === "Mutual Funds" && (
            <small>
              Date fields: start date, then next SIP date (optional).
            </small>
          )}
        </Section>

        <Section title="Allocation">
          {allocation.rows.length === 0 ? (
            <p>No investments yet.</p>
          ) : (
            allocation.rows.map((r) => {
              const pct = (r.total / allocation.sum) * 100;
              return (
                <div key={r.category} style={{ marginBottom: "8px" }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>
                      {FILTER_LABEL[r.category as Filter] ?? r.category}
                    </span>
                    <span>
                      {formatAmount(r.total)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "4px",
                      backgroundColor: "rgb(40, 39, 39)",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: "4px",
                        backgroundColor: "rgb(55, 190, 13)",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </Section>

        <Section title={`Upcoming (next ${UPCOMING_DAYS} days)`}>
          {upcoming.length === 0 ? (
            <p>Nothing due.</p>
          ) : (
            <ul style={{ paddingLeft: "20px" }}>
              {upcoming.map((u) => (
                <li key={u._id}>
                  {formatDate(u.date)} — {u.label}: {u.subject} (
                  {formatAmount(u.amount)})
                  {daysUntil(u.date) < 0 && " · overdue"}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Holdings">
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-sm ${
                  filter === f ? "btn-success" : "btn-outline-secondary"
                }`}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="table-responsive">
            <table className="table table-dark">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Invested</th>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Profit / loss</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>Loading...</td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No investments. Add one above.</td>
                  </tr>
                ) : (
                  visible.map((h) => (
                    <tr key={h._id}>
                      <td>{h.subject}</td>
                      <td>
                        {FILTER_LABEL[h.category as Filter] ?? h.category}
                      </td>
                      <td>{formatAmount(h.amount)}</td>
                      <td>{formatDate(h.date)}</td>
                      <td>{details(h)}</td>
                      <td>
                        {(() => {
                          const pl = profitLoss(h);
                          if (!pl) return "—";
                          return (
                            <span
                              style={{
                                color:
                                  pl.diff >= 0 ? "rgb(55, 190, 13)" : "tomato",
                              }}
                            >
                              {pl.diff >= 0 ? "+" : "−"}
                              {formatAmount(
                                Math.abs(Math.round(pl.diff * 100) / 100),
                              )}{" "}
                              ({Math.abs(pl.pct).toFixed(2)}%)
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-light me-2"
                          onClick={() => setEditing(h)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(h)}
                        >
                          {h.category === "FD" ? "Close" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="History">
          {activity.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark">
                <tbody>
                  {activity.map((a) => (
                    <tr key={a._id}>
                      <td>{formatDate(a.date)}</td>
                      <td>{ACTIVITY_LABEL[a.type]}</td>
                      <td>{a.subject}</td>
                      <td>
                        {a.amount !== undefined ? formatAmount(a.amount) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
      {editing && (
        <EditInvestment
          investment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default Investments;
