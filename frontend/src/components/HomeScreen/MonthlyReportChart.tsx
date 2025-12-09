import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

// Define a type for the data we expect from the API
interface ApiData {
  _id: string;
  totalSpent: number;
  category: string;
  amount: number;
}

// Define a type for the structure Chart.js expects
interface ChartData {
  labels: string[];
  datasets: any[];
}

const chartContainerStyle: React.CSSProperties = {
  height: "100%",
  width: "100%",
};

const MonthlyReportChart = () => {
  const [chartData, setChartData] = useState<ChartData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use the correct API endpoint from your backend
        const response = await fetch("/api/getamount");
        console.log("API response status:", response.status);
        const data: ApiData[] = await response.json();
        console.log("Fetched data:", data);

        // Transform the API data into the format required by Chart.js
        setChartData({
          labels: data.map((item) => item._id),
          datasets: [
            {
              label: "Amount",
              data: data.map((item) => item.totalSpent),
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
        });
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
      }
    };

    fetchData();
  }, []); // The empty dependency array ensures this runs only once when the component mounts

  // Display a loading message until the data is fetched
  if (!chartData) {
    return <div>Loading chart...</div>;
  }

  return (
    <div style={chartContainerStyle}>
      <Bar
        data={chartData}
        options={{
          maintainAspectRatio: false,
        }}
      />
    </div>
  );
};

export default MonthlyReportChart;
