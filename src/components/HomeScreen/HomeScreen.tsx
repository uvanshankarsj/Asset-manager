import { FIELD } from "../../App.interface";
import "chart.js/auto";
import { Bar } from "react-chartjs-2";

function HomeScreen() {
  const field: FIELD[] = [
    FIELD.PENDING_APPROVAL,
    FIELD.NEW_TRIP,
    FIELD.UNREPORTED_EXPENSE,
    FIELD.UPCOMING_EXPENSE,
    FIELD.UNREPORTED_ADVANCES,
  ];

  return (
    <>
      <div
        style={{
          height: "100vh",
          backgroundColor: "rgb(40, 39, 39)",
          padding: "30px",
        }}
      >
        <div
          className="container"
          style={{
            backgroundColor: "rgb(0, 0, 0)",
            height: "100%",
            padding: " 5% 3% 3% 3%",
            color: "rgb(205, 201, 200)",
          }}
        >
          <div className="row">
            <div
              className="col"
              style={{
                height: "30%",
                width: "32%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                margin: "1%",
              }}
            >
              Pending Task
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <ul>
                {field.map((field) => {
                  return (
                    <li
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "2px",
                      }}
                    >
                      <span>{field}</span>
                      <span>100</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div
              className="col-1"
              style={{
                height: "30%",
                width: "52%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                margin: "1%",
              }}
            >
              Recent expenses
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <ul>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>Subject</span>
                  <span>Amount</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>Pending approval</span>
                  <span>100</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>New Trip</span>
                  <span>100</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>unreported expense</span>
                  <span>100</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
                  <span>upcomming expense</span>
                  <span>100</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="row">
            <div
              className="col"
              style={{
                width: "100%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                margin: "1%",
              }}
            >
              Quick Access
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <ul>
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px",
                  }}
                >
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
              style={{
                width: "100%",
                backgroundColor: "rgb(40, 39, 39)",
                borderRadius: "10px",
                margin: "1%",
              }}
            >
              Monthly Report
              <hr style={{ border: "1px solid white", margin: "10px 0" }} />
              <div style={{ height: "100 %", width: "100%" }}>
                <Bar
                  data={{
                    labels: ["shares", "FD", "current account"],
                    datasets: [
                      {
                        label: "Monthly Report",
                        data: [1, 2, 10],
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
