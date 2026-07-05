import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom"
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";
import { page, card, muted, btnGhost, tableHead } from "../themeClasses";

function OptimizePortfolio() {
    const { id } = useParams();
    const [error, setError] = useState("");
    const [getting, setGetting] = useState(true);
    const [currentValue, setCurrentValue] = useState(0);
    const [holdings, setHoldings] = useState([]);
    const navigate = useNavigate();

    const handleOptimize = useCallback(async () => {
        try {
            const response = await fetch(`${backend_url}/optimize_portfolio/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.detail || result.message || "Failed to optimize portfolio");
                return;
            }

            if (!Array.isArray(result.suggestions)) {
                setError("No optimization suggestions returned from server.");
                return;
            }

            setHoldings(result.suggestions);
            setCurrentValue(result.current_value);
        } catch (err) {
            setError(err?.message || "Failed to fetch optimization results.");
        } finally {
            setGetting(false);
        }
    },[id]);

    useEffect(() => {
        setGetting(true);
        setError("");
        handleOptimize();
    }, [handleOptimize]);//what is wrong here 

    return (
        <div className={`${page} p-6`}>
            {error && <ErrorDisplay message={error} />}
            {getting ? (
              <div>
                <button
                  onClick={() => navigate(-1)}
                  className={btnGhost}
                >
                  ← Back
                </button>
                <div className={`${muted} text-center mt-2`}>Getting optimization results...</div>
              </div>):(
                <div className="space-y-6">
                <button
                  onClick={() => navigate(-1)}
                  className={btnGhost}
                >
                  ← Back
                </button>  
                <div className="text-center text-[#0d171b] dark:text-white">Optimization complete! Check your portfolio for updated allocations.</div>
                <div className={`overflow-x-auto ${card} p-6`}>
            <table className="w-full text-left">
              <thead className={tableHead}>
                <tr>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Ticker</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Currency Type</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Current Allocation</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Suggested Allocation</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Target Value</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Action</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">RiskScore</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Expected Return</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Historical Return</th>
                </tr>
              </thead>

              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`p-4 text-center ${muted}`}>
                      No optimization suggestions available.
                    </td>
                  </tr>
                ) : (
                  holdings.map((stock, index) => (
                    <tr key={stock._id || `${stock.symbol}-${index}`} className="text-[#0d171b] dark:text-white border-b border-slate-200 dark:border-slate-700">
                      <td className="p-3 font-semibold">
                        {stock.symbol}
                      </td>
                      <td className="p-3">{stock.currency_type}</td>
                      <td className="p-3">{stock.current_weight }%</td>
                      <td className="p-3">{stock.suggested_weight }%</td>
                      <td className="p-3">{stock.target_value}<span>{stock.base_currency}</span></td>
                      <td className="p-3">{stock.action}</td>

                      <td className="p-3">
                        {stock.risk_score != null ? ((stock.risk_score || 0) * 100).toFixed(1) : "-"}
                      </td>

                      <td className="p-3">
                        {stock.expected_return != null ? stock.expected_return.toFixed(2) : "-" }%
                      </td>

                      <td className="p-3">
                        {stock.historical_return != null ? stock.historical_return.toFixed(2) : "-" }%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <div className="text-[#0d171b] dark:text-white">
              <p> Current Value</p>
              <p>{currentValue}</p>
            </div>
            <div className={`text-center text-sm ${muted}`}>
                Note: RiskScore is a measure of the stock's contribution to overall portfolio risk. Expected Return is based on our predictive model, while Historical Return is based on past performance.
             </div>
            </div>
            )}
        </div>
    )
}
export default OptimizePortfolio;
                           