import { useState } from "react";
import { updateInvestment, type Investment } from "../../api";
import Modal from "../Modal";
import FormErrors from "../FormErrors";
import { useToast } from "../Toast";
import { validateInvestment, type Errors } from "../../validation";

type EditInvestmentProps = {
  investment: Investment;
  onClose: () => void;
  onSaved: () => void;
};

const fieldStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  colorScheme: "dark",
  color: "rgb(205, 201, 200)",
  width: "100%",
};

const day = (d?: string) => (d ? d.slice(0, 10) : "");

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label style={{ display: "block", marginBottom: "14px" }}>
    <span style={{ display: "block", marginBottom: "4px" }}>{label}</span>
    {children}
  </label>
);

const EditInvestment: React.FC<EditInvestmentProps> = ({
  investment: inv,
  onClose,
  onSaved,
}) => {
  const isShare = inv.category === "share";
  // Holdings saved before quantities existed only have a total amount
  const hasLot = isShare && !!inv.quantity;
  const [form, setForm] = useState({
    subject: inv.subject,
    date: day(inv.date),
    amount: String(inv.amount),
    symbol: inv.symbol ?? "",
    quantity: String(inv.quantity ?? ""),
    pricePerShare: String(inv.pricePerShare ?? ""),
    maturityDate: day(inv.maturityDate),
    nextSipDate: day(inv.nextSipDate),
  });
  const [errors, setErrors] = useState<Errors>({});
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateInvestment({ ...form, category: inv.category });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await updateInvestment(inv._id, {
        subject: form.subject,
        date: form.date,
        ...(hasLot
          ? { quantity: form.quantity, pricePerShare: form.pricePerShare }
          : { amount: form.amount }),
        ...(isShare && { symbol: form.symbol }),
        ...(inv.category === "FD" && { maturityDate: form.maturityDate }),
        ...(inv.category === "Mutual Funds" && { nextSipDate: form.nextSipDate }),
      });
      toast.success("Investment updated.");
      onSaved();
    } catch (err) {
      setErrors({
        save: err instanceof Error ? err.message : "Could not save. Try again.",
      });
      setBusy(false);
    }
  };

  const total = Number(form.quantity) * Number(form.pricePerShare);

  return (
    <Modal title={`Edit ${inv.subject}`} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        <Field label="Name">
          <input
            value={form.subject}
            onChange={set("subject")}
            aria-invalid={!!errors.subject}
            style={fieldStyle}
          />
        </Field>
        {hasLot ? (
          <>
            <Field label="No. of shares">
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={set("quantity")}
                aria-invalid={!!errors.quantity}
                style={fieldStyle}
              />
            </Field>
            <Field label="Average price per share">
              <input
                type="number"
                min="0"
                step="any"
                value={form.pricePerShare}
                onChange={set("pricePerShare")}
                aria-invalid={!!errors.pricePerShare}
                style={fieldStyle}
              />
            </Field>
            {total > 0 && (
              <small style={{ display: "block", marginBottom: "14px" }}>
                Invested: {total.toLocaleString("en-IN")}
              </small>
            )}
          </>
        ) : (
          <Field label="Amount invested">
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={set("amount")}
              aria-invalid={!!errors.amount}
              style={fieldStyle}
            />
          </Field>
        )}
        <Field label="Start / purchase date">
          <input
            type="date"
            value={form.date}
            onChange={set("date")}
            aria-invalid={!!errors.date}
            style={fieldStyle}
          />
        </Field>
        {isShare && (
          <Field label="Ticker (for the live price, e.g. RELIANCE.NS)">
            <input
              value={form.symbol}
              onChange={set("symbol")}
              style={fieldStyle}
            />
          </Field>
        )}
        {inv.category === "FD" && (
          <Field label="Maturity date">
            <input
              type="date"
              value={form.maturityDate}
              onChange={set("maturityDate")}
              aria-invalid={!!errors.maturityDate}
              style={fieldStyle}
            />
          </Field>
        )}
        {inv.category === "Mutual Funds" && (
          <Field label="Next SIP date (leave empty if there is no SIP)">
            <input
              type="date"
              value={form.nextSipDate}
              onChange={set("nextSipDate")}
              aria-invalid={!!errors.nextSipDate}
              style={fieldStyle}
            />
          </Field>
        )}
        <FormErrors errors={errors} />
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            marginTop: "14px",
          }}
        >
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-success" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
export default EditInvestment;
