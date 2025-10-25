import React, { Suspense, lazy } from "react";
import { FIELD } from "../../App.interface";
import "chart.js/auto";
import {
  Field_MAP,
  IFieldData,
  MONTHLY_REPORT_DATA,
} from "./HomeScreen.constant";

const pageContainerStyle: React.CSSProperties = {
  height: "100vh",
  backgroundColor: "rgb(40, 39, 39)",
  padding: "30px",
};

const MonthlyReportChart = lazy(() =>
  import("./MonthlyReportChart").then((module) => ({ default: module.default }))
);

const mainContainerStyle: React.CSSProperties = {
  backgroundColor: "rgb(0, 0, 0)",
  height: "100%",
  padding: " 5% 3% 3% 3%",
  color: "rgb(205, 201, 200)",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "rgb(40, 39, 39)",
  borderRadius: "10px",
  margin: "1%",
};

const hrStyle: React.CSSProperties = {
  border: "1px solid white",
  margin: "10px 0",
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "2px",
};

const threeColListItemStyle: React.CSSProperties = {
  ...listItemStyle,
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr",
  textAlign: "left",
  overflowY: "auto",
};

const amountColStyle: React.CSSProperties = {
  textAlign: "center",
};

const dateColStyle: React.CSSProperties = {
  textAlign: "right",
};

function HomeScreen() {
  const field: FIELD[] = [
    FIELD.PENDING_APPROVAL,
    FIELD.NEW_TRIP,
    FIELD.UNREPORTED_EXPENSE,
    FIELD.UPCOMING_EXPENSE,
    FIELD.UNREPORTED_ADVANCES,
  ];

  const recentExpenses = [
    { name: "Subject", amount: "Amount" },
    { name: "Pending approval", amount: "100" },
    { name: "New Trip", amount: "100" },
    { name: "unreported expense", amount: "100" },
    { name: "upcomming expense", amount: "100" },
  ];

  return (
    <>
      <div style={pageContainerStyle}>
        <div className="container" style={mainContainerStyle}>
          <div className="row">
            <div
              className="col"
              style={{
                ...cardStyle,
                height: "30%",
                width: "32%",
                overflowY: "auto",
              }}
            >
              Upcoming SIPs
              <hr style={hrStyle} />
              <ul style={{ listStyle: "none", padding: 0 }}>
                <li style={threeColListItemStyle}>
                  <strong>Name</strong>
                  <strong style={amountColStyle}>Amount</strong>
                  <strong style={dateColStyle}>Date</strong>
                </li>
                {field.map((fieldKey) => {
                  const item: IFieldData = Field_MAP[fieldKey];
                  return (
                    <li key={fieldKey} style={threeColListItemStyle}>
                      <span>{item.name}</span>
                      <span style={amountColStyle}>{item.amount}</span>
                      <span style={dateColStyle}>{item.date}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div
              className="col-1"
              style={{
                ...cardStyle,
                height: "30%",
                width: "52%",
                overflowY: "auto",
              }}
            >
              Recent expenses
              <hr style={hrStyle} />
              <ul style={{ listStyle: "none", padding: 0 }}>
                {recentExpenses.map((expense, index) => (
                  <li key={index} style={listItemStyle}>
                    <span>{expense.name}</span>
                    <span
                      style={{ textAlign: index === 0 ? "right" : "center" }}
                    >
                      {expense.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="row">
            <div className="col" style={{ ...cardStyle, width: "100%" }}>
              Quick Access
              <hr style={hrStyle} />
              <ul>
                <li style={listItemStyle}>
                  <span
                    style={{
                      padding: "2%",
                      backgroundColor: "rgba(136, 135, 135, 0.39)",
                      borderRadius: "10px",
                    }}
                  >
                    New Expenses
                  </span>
                  <span
                    style={{
                      padding: "2%",
                      backgroundColor: "rgba(136, 135, 135, 0.39)",
                      borderRadius: "10px",
                    }}
                  >
                    Add receipt
                  </span>
                  <span
                    style={{
                      padding: "2%",
                      backgroundColor: "rgba(136, 135, 135, 0.39)",
                      borderRadius: "10px",
                    }}
                  >
                    Create report
                  </span>
                  <span
                    style={{
                      padding: "2%",
                      backgroundColor: "rgba(136, 135, 135, 0.39)",
                      borderRadius: "10px",
                    }}
                  >
                    Create Trip
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="row">
            <div
              className="col"
              style={{ ...cardStyle, width: "100%", height: "40%" }}
            >
              Monthly Report
              <hr style={hrStyle} />
              <Suspense fallback={<div>Loading chart...</div>}>
                <MonthlyReportChart />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default HomeScreen;
