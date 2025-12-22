import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function PriceGraph({ dates = [], price = [], sma20 = [], sma50 = [] }) {
  const chartData = dates.map((date, idx) => ({
    date,
    price: price[idx],
    sma20: sma20[idx],
    sma50: sma50[idx],
  }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={12} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#0ea5e9"
            dot={false}
            strokeWidth={2}
            name="Price"
          />
          <Line
            type="monotone"
            dataKey="sma20"
            stroke="#22c55e"
            dot={false}
            strokeWidth={2}
            name="SMA 20"
          />
          <Line
            type="monotone"
            dataKey="sma50"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={2}
            name="SMA 50"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PriceGraph;
