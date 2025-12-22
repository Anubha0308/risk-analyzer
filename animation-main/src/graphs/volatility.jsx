import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function VolatilityChart({ dates = [], volatility = [] }) {
  const data = dates.map((date, idx) => ({
    date,
    volatility: volatility[idx],
  }));

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="volatilityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={12} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="volatility"
            stroke="#a855f7"
            fillOpacity={1}
            fill="url(#volatilityFill)"
            name="Volatility"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default VolatilityChart;
