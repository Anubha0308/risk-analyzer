import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom"
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";

function OptimizePortfolio() {
    const { id } = useParams();
    const [error, setError] = useState("");
    const [getting, setGetting] = useState(true);
    const [holdings, setHoldings] = useState([]);
    const navigate = useNavigate();

    const handleOptimize = async () => {
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
        } catch (err) {
            setError(err?.message || "Failed to fetch optimization results.");
        } finally {
            setGetting(false);
        }
    };

    useEffect(() => {
        setGetting(true);
        setError("");
        handleOptimize();
    }, [id]);

    return (
        <div className="min-h-screen bg-[#0d171b]/95 backdrop-blur-md text-white p-6">
            {error && <ErrorDisplay message={error} />}
            {getting ? (
              <div>
                <button onClick={()=>navigate(-1)} >Back</button>
                <div className="text-center mt-2">Getting optimization results...</div>
              </div>):(
                <div className="space-y-6">
                <button onClick={()=>navigate(-1)} >Back</button>
                <div className="text-center">Optimization complete! Check your portfolio for updated allocations.</div>
                <div className="overflow-x-auto rounded-lg border border-gray-700 bg-[#0d1b2e] p-4 width-[80%] mx-auto">
            <table className="w-full border border-gray-200 text-left">
              <thead className="bg-gray-100 text-black font-semibold">
                <tr>
                  <th className="p-3 border-b">Ticker</th>
                  <th className="p-3 border-b">Current Allocation</th>
                  <th className="p-3 border-b">Suggested Allocation</th>
                  <th className="p-3 border-b">Action</th>
                  <th className="p-3 border-b">RiskScore</th>
                  <th className="p-3 border-b">Expected Return</th>
                  <th className="p-3 border-b">Historical Return</th>
                </tr>
              </thead>

              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">
                      No optimization suggestions available.
                    </td>
                  </tr>
                ) : (
                  holdings.map((stock, index) => (
                    <tr key={stock._id || `${stock.symbol}-${index}`} className="text-white">
                      <td className="p-3 border-b font-semibold">
                        {stock.symbol}
                      </td>

                      <td className="p-3 border-b">{stock.current_weight}</td>

                      <td className="p-3 border-b">{stock.suggested_weight}</td>

                      <td className="p-3 border-b">{stock.action}</td>

                      <td className="p-3 border-b">
                        {stock.risk_score != null ? stock.risk_score.toFixed(2) : "-"}
                      </td>

                      <td className="p-3 border-b">
                        {stock.expected_return != null ? stock.expected_return.toFixed(2) : "-"}
                      </td>

                      <td className="p-3 border-b">
                        {stock.historical_return != null ? stock.historical_return.toFixed(2) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <div className="text-center text-sm text-gray-400">
                Note: RiskScore is a measure of the stock's contribution to overall portfolio risk. Expected Return is based on our predictive model, while Historical Return is based on past performance.
             </div>
            </div>
            )}
        </div>
    )
}
export default OptimizePortfolio;
                           