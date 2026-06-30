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

function PortfolioAnalyze() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: routeId } = useParams();
  const data = state?.analysisData;
  const id = data?.portfolio_id || routeId;

  if (!data) { // if no data is there to display
    return (
      <div className="min-h-screen bg-[#07111f] text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No analysis data found</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2 rounded-lg bg-cyan-500 text-black font-semibold"
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
  const profitClass = (value) =>
    Number(value) >= 0 ? "text-green-400" : "text-red-400";


  const riskClass = (level) => {
    if (level === "High") return "text-red-400 bg-red-500/10 border-red-500/30";
    if (level === "Medium") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-green-400 bg-green-500/10 border-green-500/30";
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-white px-8 py-6">
      
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => navigate(-1)}
          className="text-white font-semibold"
        >
          ← Back
        </button>

        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-sm"
        >
          <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
            👤
          </span>
          Profile
        </button>
      </div>

      <div className="mb-6">
        <p className="text-md md:text-3xl font-bold">{name}</p>
        <p className="text-gray-400">
          Track, analyze and optimize your investments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total Portfolio Value</p>
          <h2 className="text-2xl font-bold mt-2">{summary.total_value}<span>{base_currency}</span></h2>
          <p className={profitClass(summary.total_value_change)}>
            {summary.total_value_change_pct}%
          </p>
        </div>

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Total Profit / Loss</p>
          <h2 className={`text-2xl font-bold mt-2 ${profitClass(summary.total_pl)}`}>
            {summary.total_pl}<span>{base_currency}</span>
          </h2>
          <p className={profitClass(summary.total_pl)}>
            {summary.total_pl_pct}%
          </p>
        </div>

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Portfolio Risk Score</p>
          <h2 className="text-2xl font-bold mt-2">
            {summary.portfolio_risk_score}
          </h2>
          <p className="text-yellow-400 font-semibold">
            {summary.portfolio_risk_label}
          </p>
        </div>

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Today's Change</p>
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
        <div className="lg:col-span-1 bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-4">Portfolio Value Over Time</h3>
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

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-4">Risk Contribution</h3>
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

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-4">Sector Allocation</h3>
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
        <div className="lg:col-span-2 bg-[#0d1b2e] border border-slate-700 rounded-xl overflow-hidden">
          <h3 className="font-bold p-5 border-b border-slate-700">
            Your Holdings
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#13243a] text-gray-300">
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
                  <tr key={stock._id} className="border-b border-slate-700">
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

        <div className="bg-[#0d1b2e] border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold mb-3">AI Optimization Suggestion</h3>
          <p className="text-gray-300 text-sm mb-5">{data.ai_suggestion}</p>

          <div className="border border-green-500/40 rounded-xl p-4 mb-5 text-sm text-green-300">
            {data.risk_alert}
          </div>

          <button className="w-full border border-green-500 text-green-400 rounded-lg py-3 font-semibold hover:bg-green-500/10"
            onClick={() => navigate(`/optimize/${id}`)}>
            View Optimized Portfolio
          </button>
        </div>
      </div>
      {/* //need to fix the alignment here  */}
      <div className="mt-5 bg-[#0d1b2e] border border-slate-700 rounded-xl p-4 text-sm text-gray-300"> 
        <FXSignalPanel currencyInsight={currencyInsight} />
      </div>
      {/* Bottom Alert */}
      <div className="mt-5 bg-[#0d1b2e] border border-slate-700 rounded-xl p-4 text-sm text-gray-300">
        Your portfolio risk score is{" "}
        <span className="text-yellow-400 font-semibold">
          {summary.portfolio_risk_label}
        </span>
        . Consider diversifying more to reduce concentration risk.
      </div>
    </div>
  );
}

export default PortfolioAnalyze;