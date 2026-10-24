import "chart.js/auto";
import { Bar } from "react-chartjs-2";
import { useCallback, useEffect, useState } from "react";
import {
  fetchCategoryTotals,
  fetchRecentActivity,
  fetchPendingActions,
  deleteMaturedFD,
  markSipPaid,
  type PendingAction,
  type CategoryTotal,
  type RecentActivity,
} from "../../api";
import { useToast } from "../Toast";

function HomeScreen() {
  const todayUtc = () => new Date().toISOString().slice(0, 10);
  const isDue = (a: PendingAction) => new Date(a.date) <= new Date();
  const actionLabel = (a: PendingAction) => {
    if (a.type === "FD_MATURITY") return isDue(a) ? "FD matured" : "FD maturing";
    if (!isDue(a)) return "SIP due";
    return a.date.slice(0, 10) === todayUtc() ? "SIP due today" : "SIP overdue";
  };
  const ACTIVITY_LABEL: Record<RecentActivity["type"], string> = {
    NEW_FD: "New FD started",
    SIP_STARTED: "SIP started",
    FD_CLOSED: "FD closed",
    SIP_PAID: "SIP paid",
    ADDED: "Investment added",
  };
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const [totals, setTotals] = useState<CategoryTotal[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadAll = useCallback(
    () =>
      Promise.all([
        fetchCategoryTotals(),
        fetchRecentActivity(),
        fetchPendingActions(),
      ])
        .then(([t, r, p]) => {
          setTotals(t);
          setRecent(r);
          setPending(p);
          setError(null);
        })
        .catch((err: Error) => {
          setError(err.message);
          toast.error(err.message);
        })
        .finally(() => setLoading(false)),
    [toast]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAction = async (a: PendingAction) => {
    const confirmed =
      a.type === "FD_MATURITY"
        ? window.confirm(
            `"${a.subject}" has matured. Delete this FD record? This cannot be undone.`
          )
        : window.confirm(
            `Mark the SIP instalment for "${a.subject}" as paid? The next date will move forward by one month.`
          );
    if (!confirmed) return;
    try {
      if (a.type === "FD_MATURITY") await deleteMaturedFD(a._id);
      else await markSipPaid(a._id);
      await loadAll();
      toast.success(
        a.type === "FD_MATURITY" ? "FD record deleted." : "SIP marked as paid."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not complete the action."
      );
    }
  };

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
        <div
          className="page-card"
          style={{
            backgroundColor: "rgb(0, 0, 0)",
            borderRadius: "20px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "3% 3% 3% 3%",
            color: "rgb(205, 201, 200)",
          }}
        >
          <div className="row" style={{ flex: 1, minHeight: 0 }}>
            <div
              className="col home-panel"
              style={{
                width: "48%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                overflowY: "auto",
                margin: "1%",
              }}
            >
              Pending Actions
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <ul>
                {pending.map((a) => (
                  <li
                    key={a._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "2px",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {actionLabel(a)} - {a.subject}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(a.date)}
                      <span
                        style={{
                          width: "100px",
                          marginLeft: "10px",
                          textAlign: "right",
                        }}
                      >
                        {isDue(a) && (
                          <button
                            className="btn btn-sm btn-success text-nowrap"
                            onClick={() => handleAction(a)}
                          >
                            {a.type === "FD_MATURITY" ? "Delete" : "Mark paid"}
                          </button>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
                {loading && <li>Loading...</li>}
                {!loading && !error && pending.length === 0 && (
                  <li>No upcoming FD maturities or SIPs</li>
                )}
              </ul>
            </div>
            <div
              className="col-1 home-panel"
              style={{
                width: "48%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                overflowY: "auto",
                margin: "1%",
              }}
            >
              Recent Transactions
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <ul>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>Action</span>
                  <span>Amount</span>
                </li>
                {recent.map((e) => (
                  <li
                    key={e._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "2px",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {ACTIVITY_LABEL[e.type]} - {e.subject}
                    </span>
                    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                      {e.amount ?? ""}
                      <small style={{ marginLeft: "10px", opacity: 0.6 }}>
                        {formatDate(e.date)}
                      </small>
                    </span>
                  </li>
                ))}
                {loading && <li>Loading...</li>}
                {!loading && !error && recent.length === 0 && (
                  <li>No activity yet</li>
                )}
                {error && <li>{error}</li>}
              </ul>
            </div>
          </div>
          <div className="row" style={{ flex: 1, minHeight: 0 }}>
            <div
              className="col home-panel"
              style={{
                width: "98%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                margin: "1%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              Monthly Report
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <div
                className="home-chart"
                style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}
              >
                <Bar
                  data={{
                    labels: totals.map((t) => t._id),
                    datasets: [
                      {
                        label: "Monthly Report",
                        data: totals.map((t) => t.totalSpent),
                        backgroundColor: [
                          "rgba(75, 192, 192, 0.2)",
                          "rgba(153, 102, 255, 0.2)",
                          "rgba(255, 159, 64, 0.2)",
                        ],
                        borderColor: [
                          "rgba(75, 192, 192, 1)",
                          "rgba(153, 102, 255, 1)",
                          "rgba(255, 159, 64, 1)",
                        ],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default HomeScreen;
