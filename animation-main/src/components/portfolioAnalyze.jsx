import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import FXSignalPanel from "./FXsignal";
import { page, card, muted, btnPrimary, btnGhost, tableHead, profitCls } from "../themeClasses";

function PortfolioAnalyze() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: routeId } = useParams();
  const data = state?.analysisData;
  const id = data?.portfolio_id || routeId;

  if (!data) { // if no data is there to display
    return (
      <div className={`${page} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-[#0d171b] dark:text-white">No analysis data found</h2>
          <button
            onClick={() => navigate(-1)}
            className={`${btnPrimary} px-5 py-2`}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const name = data.portfolio_name || "Your Portfolio";
  const base_currency = data.base_currency;
  const summary = data.summary || {};
  const holdings = data.holdings || [];
  const riskContribution = data.risk_contribution || [];
  const sectorAllocation = data.sector_allocation || [];
  const valueOverTime = data.value_over_time || [];
  const currencyInsight = data.currency_insight || {};

  const colors = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];

  //according to profit or loss decide the colour 
  const profitClass = profitCls;


  const riskClass = (level) => {
    if (level === "High") return "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30";
    if (level === "Medium") return "text-amber-600 dark:text-yellow-400 bg-amber-500/10 border-amber-500/30";
    return "text-emerald-600 dark:text-green-400 bg-emerald-500/10 border-emerald-500/30";
  };

  return (
    <div className={`${page} px-8 py-6`}>
      
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => navigate(-1)}
          className={btnGhost}
        >
          ← Back
        </button>

        <button
          onClick={() => navigate("/profile")}
          className={`flex items-center gap-2 text-sm ${btnGhost}`}
        >
          <span className="w-8 h-8 rounded-full bg-[#13a4ec]/20 text-[#13a4ec] flex items-center justify-center">
            👤
          </span>
          Profile
        </button>
      </div>

      <div className="mb-6">
        <p className="text-md md:text-3xl font-bold text-[#0d171b] dark:text-white">{name}</p>
        <p className={muted}>
          Track, analyze and optimize your investments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`${card} p-5`}>
          <p className={`${muted} text-sm`}>Total Portfolio Value</p>
          <h2 className="text-2xl font-bold mt-2 text-[#0d171b] dark:text-white">{summary.total_value}<span>{base_currency}</span></h2>
          <p className={profitClass(summary.total_value_change)}>
            {summary.total_value_change_pct}%
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className={`${muted} text-sm`}>Total Profit / Loss</p>
          <h2 className={`text-2xl font-bold mt-2 ${profitClass(summary.total_pl)}`}>
            {summary.total_pl}<span>{base_currency}</span>
          </h2>
          <p className={profitClass(summary.total_pl)}>
            {summary.total_pl_pct}%
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className={`${muted} text-sm`}>Portfolio Risk Score</p>
          <h2 className="text-2xl font-bold mt-2 text-[#0d171b] dark:text-white">
            {summary.portfolio_risk_score}
          </h2>
          <p className="text-amber-600 dark:text-yellow-400 font-semibold">
            {summary.portfolio_risk_label}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className={`${muted} text-sm`}>Today's Change</p>
          <h2 className={`text-2xl font-bold mt-2 ${profitClass(summary.total_value_change)}`}>
            {summary.total_value_change}<span>{base_currency}</span>
          </h2>
          <p className={profitClass(summary.total_value_change)}>
            {summary.total_value_change_pct}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className={`lg:col-span-1 ${card} p-5`}>
          <h3 className="font-bold mb-4 text-[#0d171b] dark:text-white">Portfolio Value Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={valueOverTime}>
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`${card} p-5`}>
          <h3 className="font-bold mb-4 text-[#0d171b] dark:text-white">Risk Contribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={riskContribution}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {riskContribution.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${card} p-5`}>
          <h3 className="font-bold mb-4 text-[#0d171b] dark:text-white">Sector Allocation</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sectorAllocation}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {sectorAllocation.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${card} overflow-hidden`}>
          <h3 className="font-bold p-5 border-b border-slate-200 dark:border-slate-700 text-[#0d171b] dark:text-white">
            Your Holdings
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={tableHead}>
                <tr>
                  <th className="p-3 text-left">Stock</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Buy Price</th>
                  <th className="p-3 text-left">Current Price</th>
                  <th className="p-3 text-left">Current Price<span>({base_currency})</span></th>
                  <th className="p-3 text-left">Current Value<span>({base_currency})</span></th>
                  <th className="p-3 text-left">P/L<span>({base_currency})</span></th>
                  <th className="p-3 text-left">P/L %</th>
                  <th className="p-3 text-left">Risk</th>
                </tr>
              </thead>

              <tbody>
                {holdings.map((stock) => (
                  <tr key={stock._id} className="border-b border-slate-200 dark:border-slate-700 text-[#0d171b] dark:text-white">
                    <td className="p-3 font-semibold">{stock.symbol}</td>
                    <td className="p-3">{stock.quantity}</td>
                    <td className="p-3">{stock.avg_buy_price}</td>
                    <td className="p-3">{stock.current_price}<span>{stock.currency_type}</span></td>
                    <td className="p-3">{stock.current_price_usd}</td>
                    <td className="p-3">{stock.current_value}</td>
                    <td className={`p-3 ${profitClass(stock.pl_amount)}`}>
                      {stock.pl_amount}
                    </td>
                    <td className={`p-3 ${profitClass(stock.pl_pct)}`}>
                      {stock.pl_pct}%
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-md border text-xs ${riskClass(
                          stock.risk_level
                        )}`}
                      >
                        {stock.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-5`}>
          <h3 className="font-bold mb-3 text-[#0d171b] dark:text-white">AI Optimization Suggestion</h3>
          <p className="text-[#4c809a] dark:text-slate-300 text-sm mb-5">{data.ai_suggestion}</p>

          <div className="border border-emerald-500/40 rounded-xl p-4 mb-5 text-sm text-emerald-700 dark:text-green-300">
            {data.risk_alert}
          </div>

          <button className="w-full border border-emerald-500 text-emerald-600 dark:text-green-400 rounded-lg py-3 font-semibold hover:bg-emerald-500/10 transition-colors"
            onClick={() => navigate(`/optimize/${id}`)}>
            View Optimized Portfolio
          </button>
        </div>
      </div>
      {/* //need to fix the alignment here  */}
      <div className={`mt-5 ${card} p-4 text-sm text-[#4c809a] dark:text-slate-300 bg-slate-50 dark:bg-[#0d171b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg`}> 
        <FXSignalPanel currencyInsight={currencyInsight} />
      </div>
      {/* Bottom Alert */}
      <div className={`mt-5 ${card} p-4 text-sm text-[#4c809a] dark:text-slate-300`}>
        Your portfolio risk score is{" "}
        <span className="text-amber-600 dark:text-yellow-400 font-semibold">
          {summary.portfolio_risk_label}
        </span>
        . Consider diversifying more to reduce concentration risk.
      </div>
    </div>
  );
}

export default PortfolioAnalyze;