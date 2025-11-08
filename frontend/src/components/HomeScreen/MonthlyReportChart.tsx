import React from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { MONTHLY_REPORT_DATA } from "../HomeScreen/HomeScreen.constant";

const chartContainerStyle: React.CSSProperties = {
  height: "100%",
  width: "100%",
};

const MonthlyReportChart = () => {
  return (
    <div style={chartContainerStyle}>
      <Bar
        data={{
          labels: MONTHLY_REPORT_DATA.labels,
          datasets: [
            {
              label: "Amount",
              data: MONTHLY_REPORT_DATA.data.map((item) => item.value),
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
  );
};

export default MonthlyReportChart;
