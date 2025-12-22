import React from "react";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

const getGaugeColor = (value) => {
  if (value >= 70) return "#ef4444"; // high risk
  if (value >= 40) return "#f59e0b"; // medium risk
  return "#22c55e"; // low risk
};

function RiskGauge({ value = 0 }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const color = getGaugeColor(clampedValue);
  const data = [
    {
      name: "Risk",
      value: clampedValue,
      fill: color,
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "260px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="80%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={16}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            tick={false}
            angleAxisId={0}
          />
          <RadialBar
            dataKey="value"
            cornerRadius={20}
            background
            fill={color}
            clockWise
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          bottom: "35px",
          textAlign: "center",
          color: "#1f2937",
        }}
      >
        <div style={{ fontSize: "14px", color: "#6b7280" }}>Risk</div>
        <div style={{ fontSize: "28px", fontWeight: 700 }}>
          {clampedValue.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

export default RiskGauge;
