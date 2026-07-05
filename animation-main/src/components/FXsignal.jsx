// Props: { currencyInsight } — the currency_insight object from analyze_portfolio API
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const DIRECTION_COLOR = {
  weakening: {
    bg: "#2d1a0a",
    border: "#c2410c",
    badge: "#ea580c",
    text: "INR Weakening",
  },
  strengthening: {
    bg: "#0a2d1a",
    border: "#15803d",
    badge: "#16a34a",
    text: "INR Strengthening",
  },
  neutral: {
    bg: "#1a1f2d",
    border: "#4b5563",
    badge: "#6b7280",
    text: "Neutral",
  },
};

const VOL_COLOR = {
  high: "#ef4444",
  normal: "#10b981",
  low: "#60a5fa",
};

const MATURITY_LABEL = {
  early: "Early Signal",
  established: "Established",
  fading: "Fading",
};

const MATURITY_COLOR = {
  early: "#f59e0b",
  established: "#10b981",
  fading: "#ef4444",
};

export default function FXSignalPanel({ currencyInsight }) {
  if (!currencyInsight) return null;

  const {
    usdinrallocation = [],
    usdinr_pl_pct = [],
    fx_rate_current,
    fx_change_30d_pct,
    trend_signal,
    recommendation,
  } = currencyInsight;

  const allocationData = usdinrallocation.length
    ? usdinrallocation
    : [{ name: "No data", value: 1 }];
  const plData = usdinr_pl_pct.some((entry) => entry.value !== 0)
    ? usdinr_pl_pct.map((entry) => ({
        name: `${entry.name.toUpperCase()} ${entry.value >= 0 ? "+" : ""}${entry.value}%`,
        value: Math.abs(entry.value),
      }))
    : [{ name: "No data", value: 1 }];

  const signal = trend_signal || {};
  const direction = signal.trend_direction || "neutral";
  const theme = DIRECTION_COLOR[direction] || DIRECTION_COLOR.neutral;

  const colors = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];
  

  return (
    <div className={`bg-slate-50 dark:bg-[#0d171b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-4 text-sm text-[#4c809a] dark:text-slate-300`}>
    
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span className="font-bold text-sm text-gray-600 dark:text-gray-400">
          FX Signal · USD/INR
        </span>
        <span
          style={{
            background: theme.badge,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 5,
            padding: "3px 9px",
            letterSpacing: 0.5,
          }}
        >
          {theme.text}
        </span>
      </div>

      {/* Rate + 30d change */}
      <div style={{ gap: 16, marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            background: "transparent",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>
            Current Rate
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#f0b429",
              fontFamily: "monospace",
            }}
          >
            ₹{fx_rate_current?.toFixed(2) ?? "—"}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: "transparent",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>
            30d Change
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "monospace",
              color:
                fx_change_30d_pct > 0
                  ? "#ea580c"
                  : fx_change_30d_pct < 0
                    ? "#16a34a"
                    : "#6b7280",
            }}
          >
            {fx_change_30d_pct != null
              ? `${fx_change_30d_pct > 0 ? "+" : ""}${fx_change_30d_pct.toFixed(2)}%`
              : "—"}
          </div>
        </div>
      </div>

      {/* Currency allocation bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#f8fafc] dark:bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-4">USD-INR Allocation</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={allocationData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {allocationData.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#f8fafc] dark:bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-4">USD-INR P/L %</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={plData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {plData.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signal badges */}
      {trend_signal && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {/* Trend strength */}
          <div
            className="bg-slate-300 dark:bg-slate-700 text-slate-300 dark:text-slate-400 text-xs font-medium px-2 py-1 rounded"
          >
          
            <span style={{ color: "#6b7280" }}>Strength · </span>
            <span
              style={{
                fontWeight: 600,
                textTransform: "capitalize",
                color: "" + (signal.trend_strength === "strong" ? "#16a34a" : signal.trend_strength === "weak" ? "#ef4444" : "#6b7280"),
              }}
            >
              {signal.trend_strength}
            </span>
          </div>

          {/* Maturity */}
          <div
            className="bg-slate-300 dark:bg-slate-700 text-slate-300 dark:text-slate-400 text-xs font-medium px-2 py-1 rounded"
          >
          
            <span style={{ color: "#6b7280" }}>Signal · </span>
            <span
              style={{
                fontWeight: 600,
                color: MATURITY_COLOR[signal.trend_maturity],
              }}
            >
              {MATURITY_LABEL[signal.trend_maturity]}
            </span>
          </div>

          {/* Volatility */}
          <div
            className="bg-slate-300 dark:bg-slate-700 text-slate-300 dark:text-slate-400 text-xs font-medium px-2 py-1 rounded"
          >
          
            <span style={{ color: "#6b7280" }}>Vol · </span>
            <span
              style={{
                fontWeight: 600,
                textTransform: "capitalize",
                color: VOL_COLOR[signal.vol_label],
              }}
            >
              {signal.vol_label}
            </span>
          </div>

          {/* Crossover age */}
          <div className="bg-slate-300 dark:bg-slate-700 text-slate-300 dark:text-slate-400 text-xs font-medium px-2 py-1 rounded"
           
          >
            <span style={{ color: "#6b7280" }}>MA Cross · </span>
            <span style={{ fontWeight: 600, color: "gray" }}>
              {signal.crossover_days_ago} days ago
            </span>
          </div>

          {/* R² confidence bar */}
          <div
            style={{
              background: "#f8fafc dark:#0d1b2e",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "#6b7280" }}>Confidence</span>
            <div
              style={{
                width: 48,
                background: "#0d1525",
                borderRadius: 3,
                height: 5,
              }}
            >
              <div
                style={{
                  width: `${(signal.r_squared ?? 0) * 100}%`,
                  background: "#f0b429",
                  height: "100%",
                  borderRadius: 3,
                }}
              />
            </div>
            <span className="text-slate-600 dark:text-slate-400 font-mono">
              {((signal.r_squared ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div
          style={{
            background: theme.bg,
            border: `1px solid ${theme.border}44`,
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 12,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: "#f0b429", fontWeight: 700, marginRight: 4 }}>
            💡
          </span>
          {recommendation}
        </div>
      )}
    </div>
  );
}
