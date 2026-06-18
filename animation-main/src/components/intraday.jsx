import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import ErrorDisplay from "./ErrorDisplay";
import { backend_url } from "../config";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function Intraday() {
  const { symbol } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartData, setChartData] = useState([]);
  const [latestPrice, setLatestPrice] = useState(null);

  const fetchIntraday = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${backend_url}/intraday-chart/${symbol}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || "Unable to load intraday data.");
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.times) || !Array.isArray(data.prices)) {
        throw new Error("Invalid intraday response from server.");
      }

      const prices = data.prices.map((price, index) => ({
        time: data.times[index] || "",
        price: typeof price === "string" ? parseFloat(price) : price,
      })).filter((item) => item.time && item.price != null && !Number.isNaN(item.price));

      setChartData(prices);
      setLatestPrice(prices.length > 0 ? prices[prices.length - 1].price : null);
    } catch (err) {
      setError(err.message || "Failed to load intraday chart.");
    } finally {
      setLoading(false);
    }
  },[symbol]);

  useEffect(() => {
    fetchIntraday();
  }, [fetchIntraday]);//what is wrong here 

  const formattedSymbol = symbol?.toUpperCase() || "";
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  console.log(chartData);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white py-10">
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900/95 mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#4c809a] dark:text-slate-400 mb-1">
                Intraday chart
              </p>
              <h1 className="text-3xl font-bold text-[#0d171b] dark:text-white">
                {formattedSymbol}
              </h1>
              <p className="text-sm text-[#4c809a] dark:text-slate-400 mt-1">
                {todayLabel}
              </p>
            </div>
            {latestPrice != null && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-right shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-[0.24em] text-[#4c809a] dark:text-slate-400">
                  Latest price
                </p>
                <p className="mt-2 text-3xl font-bold text-[#0d171b] dark:text-white">
                  ${latestPrice.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-[#0d171b] dark:text-white">
              Price movement
            </h2>
            <p className="text-sm text-[#4c809a] dark:text-slate-400">
              30-minute intraday prices for today.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#13a4ec]/30 border-t-[#13a4ec]"></div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center text-[#4c809a] dark:text-slate-400">
              No intraday data available for this symbol.
            </div>
          ) : (
            
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">

                <LineChart data={chartData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#0ea5e9"
                    dot={false}
                    strokeWidth={2}
                    name="Price"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Intraday;
