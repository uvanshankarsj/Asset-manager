import { FIELD } from "../../App.interface";

export interface IFieldData {
  name: string;
  amount: number;
  date: string;
}

export const Field_MAP: Record<FIELD, IFieldData> = {
  [FIELD.PENDING_APPROVAL]: {
    name: "Pending approval",
    amount: 1500,
    date: "2024-08-01",
  },
  [FIELD.NEW_TRIP]: { name: "New Trip", amount: 3000, date: "2024-08-05" },
  [FIELD.UNREPORTED_EXPENSE]: {
    name: "Unreported expense",
    amount: 500,
    date: "2024-08-10",
  },
  [FIELD.UPCOMING_EXPENSE]: {
    name: "Upcoming expense",
    amount: 1200,
    date: "2024-08-15",
  },
  [FIELD.UNREPORTED_ADVANCES]: {
    name: "Unreported advances",
    amount: 2000,
    date: "2024-08-20",
  },
};

export interface IMonthlyReportData {
  label: string;
  value: number;
}

export const MONTHLY_REPORT_DATA = {
  labels: ["shares", "FD", "current account"],
  data: [
    { label: "shares", value: 50 },
    { label: "FD", value: 50 },
    { label: "current account", value: 100 },
  ],
};
