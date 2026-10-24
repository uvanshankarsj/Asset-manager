import { useState } from "react";
import { createExpense } from "../../api";
import FormErrors from "../FormErrors";
import { useToast } from "../Toast";
import { validateInvestment, type Errors } from "../../validation";

const CATEGORY_OPTIONS = [
  { label: "FD", value: "FD" },
  { label: "Mutual Funds", value: "Mutual Funds" },
  { label: "Shares", value: "share" },
  { label: "Others", value: "Other" },
];

const fieldStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  width: "40%",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  colorScheme: "dark",
  color: "rgb(205, 201, 200)",
};

const EMPTY = {
  subject: "",
  merchant: "",
  date: "",
  amount: "",
  category: "",
  maturityDate: "",
  nextSipDate: "",
};

const Expenses: React.FC = () => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const set =
    (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // This form takes a total for every category, so a share is checked like any other amount
    // (the quantity x price rules belong to the Investments page)
    const found = validateInvestment({
      ...form,
      category: form.category === "share" ? "Other" : form.category,
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await createExpense({
        ...form,
        subject: form.subject.trim(),
        // only send the date that belongs to the selected category
        maturityDate: form.category === "FD" ? form.maturityDate : "",
        nextSipDate: form.category === "Mutual Funds" ? form.nextSipDate : "",
      });
      setForm(EMPTY);
      toast.success("Saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const rows: {
    key: keyof typeof EMPTY;
    label: string;
    type?: string;
    required?: boolean;
    show?: boolean;
  }[] = [
    { key: "subject", label: "Subject", required: true },
    { key: "merchant", label: "Merchant" },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "amount", label: "Total", type: "number", required: true },
    { key: "category", label: "Category", required: true },
    {
      key: "maturityDate",
      label: "Maturity date",
      type: "date",
      show: form.category === "FD",
    },
    {
      key: "nextSipDate",
      label: "Next SIP date",
      type: "date",
      show: form.category === "Mutual Funds",
    },
  ];

  return (
    <>
      <div
        className="page"
        style={{
          height: "100vh",
          backgroundColor: "rgb(40, 39, 39)",
          padding: "30px 30px 30px 0px",
        }}
      >
        <form
          noValidate
          className="page-card"
          onSubmit={handleSubmit}
          style={{
            backgroundColor: "rgb(0, 0, 0)",
            height: "100%",
            color: "rgb(205, 201, 200)",
            borderRadius: "20px",
            padding: " 3% 3% 3% 3%",
          }}
        >
          <h1>New expense</h1>
          <hr style={{ border: "1px solid white", margin: "10px 0" }} />
          {rows
            .filter((r) => r.show !== false)
            .map((r) => (
              <div key={r.key} className="form-row">
                <label
                  htmlFor={r.key}
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                    padding: "10px",
                    width: "180px",
                  }}
                >
                  {r.label}
                </label>
                {r.key === "category" ? (
                  <select
                    id={r.key}
                    name={r.key}
                    value={form.category}
                    onChange={set("category")}
                    aria-invalid={!!errors.category}
                    style={fieldStyle}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={r.type ?? "text"}
                    id={r.key}
                    name={r.key}
                    value={form[r.key]}
                    onChange={set(r.key)}
                    aria-invalid={!!errors[r.key === "date" ? "date" : r.key]}
                    placeholder={
                      r.type === "date" ? undefined : `Enter ${r.label} here`
                    }
                    style={fieldStyle}
                  />
                )}
              </div>
            ))}
          <button type="submit" className="btn btn-success" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <FormErrors errors={errors} />
        </form>
      </div>
    </>
  );
};

export default Expenses;
