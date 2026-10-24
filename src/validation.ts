// Form checks shared by the Expenses, Investments and Assets screens.
// Each returns { fieldName: message }. An empty object means the form is valid.
export type Errors = Record<string, string>;

const isDate = (v: string) => v !== "" && !isNaN(new Date(v).getTime());
const positive = (v: string) => v.trim() !== "" && Number(v) > 0;

type InvestmentFields = {
  subject: string;
  category: string;
  date: string;
  amount?: string;
  quantity?: string;
  pricePerShare?: string;
  maturityDate?: string;
  nextSipDate?: string;
};

export function validateInvestment(f: InvestmentFields): Errors {
  const e: Errors = {};
  if (!f.subject.trim()) e.subject = "Enter a name.";
  if (!f.category) e.category = "Choose a type.";
  if (!isDate(f.date)) e.date = "Enter a start date.";

  if (f.category === "share") {
    if (!positive(f.quantity ?? "")) e.quantity = "Number of shares must be more than 0.";
    if (!positive(f.pricePerShare ?? "")) e.pricePerShare = "Price per share must be more than 0.";
  } else if (!positive(f.amount ?? "")) {
    e.amount = "Amount must be more than 0.";
  }

  // The cross-field rules only make sense once the start date itself is valid
  if (!e.date) {
    if (f.category === "FD" && f.maturityDate) {
      if (!isDate(f.maturityDate)) e.maturityDate = "Enter a valid maturity date.";
      else if (f.maturityDate <= f.date) e.maturityDate = "Maturity date must be after the start date.";
    }
    if (f.category === "Mutual Funds" && f.nextSipDate) {
      if (!isDate(f.nextSipDate)) e.nextSipDate = "Enter a valid SIP date.";
      else if (f.nextSipDate < f.date) e.nextSipDate = "Next SIP date can't be before the start date.";
    }
  }
  return e;
}

export function validateAsset(f: { name: string; price: string; purchaseDate: string }): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter a product name.";
  if (f.price.trim() === "" || !(Number(f.price) >= 0)) e.price = "Price must be 0 or more.";
  if (!isDate(f.purchaseDate)) e.purchaseDate = "Enter the purchase date.";
  return e;
}
