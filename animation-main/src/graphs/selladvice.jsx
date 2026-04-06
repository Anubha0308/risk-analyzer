import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { backend_url } from "../config.js";
import ErrorDisplay from "../components/ErrorDisplay.jsx";
import RiskGauge from "./riskgauge.jsx";
import PriceGraph from "./pricegraph.jsx";
import VolatilityChart from "./volatility.jsx";

function SellAdvice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { symbol } = location.state || {};

  const handlePredict = async (selectedStock) => {
    if (!selectedStock) {
      setError("Please select a stock");
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);

    try {
      const response = await fetch(
        `${backend_url}/predict/risk/${selectedStock}`,
        {
          method: "GET",
          credentials: "include", // Important for cookies
        }
      );

      const data = await response.json();

      if (response.ok) {
        setPrediction(data);
      } else {
        if (response.status === 401) {
          setError("Please login to access this feature");
          setTimeout(() => navigate("/login"), 2000);
        } else {
          setError(data.detail || "Failed to get prediction");
        }
      }
    } catch (err) {
      setError("Network error. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch(`${backend_url}/me`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          setIsAuthenticated(true);
          // If authenticated and symbol exists, fetch prediction
          if (symbol) {
            handlePredict(symbol);
          } else {
            setError("No stock symbol provided. Please go to the homepage to select a stock.");
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (checkingAuth) {
    return (
      <div className="bg-[#f6f7f8] dark:bg-[#0d171b] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen p-5 sm:p-10 antialiased" style={{ fontFamily: "Manrope, sans-serif" }}>
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}

      <div className={`max-w-7xl mx-auto w-full bg-white dark:bg-slate-900/80 p-6 sm:p-14 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-200 dark:ring-slate-800`}>
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#0d171b] dark:text-white mb-2">
            Sell Advice
          </h1>
          <p className="text-[#4c809a] dark:text-slate-400 text-lg">
            {symbol ? `ML-based risk and price trends for ${symbol}` : "AI-powered stock risk analysis"}
          </p>
        </div>

        {!isAuthenticated ? (
          <div>
             <div className="text-center p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 mb-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13a4ec] mb-5">
                    <span className="material-symbols-outlined text-white text-4xl">lock</span>
                </div>
                <h2 className="text-2xl font-bold text-[#0d171b] dark:text-white mb-3">
                    Login Required
                </h2>
                <p className="text-[#4c809a] dark:text-slate-400 max-w-xl mx-auto mb-8">
                    Sign in to access comprehensive AI-powered stock risk analysis and get detailed insights for {symbol || "your stocks"}.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link to="/login" className="inline-flex items-center justify-center rounded-xl bg-[#13a4ec] hover:bg-[#0f8ac4] px-6 py-3 text-base font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all">
                        Login
                    </Link>
                    <Link to="/register" className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-6 py-3 text-base font-bold text-[#13a4ec] ring-2 ring-inset ring-[#13a4ec] transition-all">
                        Sign Up
                    </Link>
                </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#0d171b] dark:text-white mb-6">
                What you'll get with full access:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[{
                      title: "Risk Probability",
                      description: "Get precise risk scores (0-100%) calculated using advanced ML models that analyze market volatility, price trends, and historical patterns.",
                      icon: "warning",
                      color: "red"
                  }, {
                      title: "Detailed Reasons",
                      description: "Understand the \"why\" behind each risk assessment with AI-generated explanations covering market conditions, technical indicators, and trend analysis.",
                      icon: "lightbulb",
                      color: "green"
                  }, {
                      title: "Price & Volatility Charts",
                      description: "Visualize 90-day price trends with SMA-20 and SMA-50 indicators, plus volatility analysis to spot potential risk patterns.",
                      icon: "show_chart",
                      color: "blue"
                  }, {
                      title: "Sell Recommendations",
                      description: "Receive actionable sell/hold recommendations based on risk levels (HIGH, MEDIUM, LOW) to protect your portfolio from potential losses.",
                      icon: "trending_down",
                      color: "amber"
                  }].map(item => (
                      <div key={item.title} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                          <div className="flex items-center gap-4 mb-4">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-${item.color}-500/15 text-${item.color}-500`}>
                                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                              </div>
                              <h4 className="text-lg font-bold text-[#0d171b] dark:text-white">{item.title}</h4>
                          </div>
                          <p className="text-sm text-[#4c809a] dark:text-slate-400 leading-relaxed">{item.description}</p>
                      </div>
                  ))}
              </div>
            </div>

          </div>
        ) : (
          <>
            {loading && (
              <div className="text-center p-10 flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
                <p className="text-[#4c809a] dark:text-slate-400">Analyzing {symbol}...</p>
              </div>
            )}

            {prediction && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="text-sm text-[#4c809a] dark:text-slate-400 mb-1">Symbol</div>
                        <div className="text-4xl font-bold text-[#0d171b] dark:text-white">{prediction.symbol}</div>
                      </div>
                      <div className="text-right flex flex-row gap-10">
                        <div className="text-sm text-[#4c809a] dark:text-slate-400 mb-1">Current Price</div>
                        <div className="text-4xl font-bold text-[#0d171b] dark:text-white">${prediction.current_price}</div>
                        <div className="text-xs text-[#4c809a] dark:text-slate-400 mb-1">Price Change</div>
                        <div className="text-2xl font-bold text-[#0d171b] dark:text-white">${prediction.price_change}</div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 mb-6">
                        <h4 className="font-bold text-[#0d171b] dark:text-white mb-2">Recommendation</h4>
                        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">{prediction.recommendation}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-[#0d171b] dark:text-white mb-3">Why this assessment</h4>
                      <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                        {(prediction.reasons || []).map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 flex flex-col items-center justify-center gap-4">
                    <div className={`text-base font-bold px-4 py-2 rounded-full ${prediction.risk_level === 'HIGH' ? 'bg-red-500/15 text-red-500' : prediction.risk_level === 'MEDIUM' ? 'bg-amber-500/15 text-amber-500' : 'bg-green-500/15 text-green-500'}`}>
                        {prediction.risk_level} RISK
                      </div>
                    <RiskGauge value={(prediction.risk_score || 0) * 100} />
                    <div className="text-center flex flex-row gap-2">
                        <div className="text-sm text-[#4c809a] dark:text-slate-400">
                            Risk Score
                        </div>
                        <div className="text-3xl font-bold text-[#0d171b] dark:text-white">
                            {((prediction.risk_score || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-[#4c809a] dark:text-slate-400">
                            Risk Change since last analysis
                        </div>
                        <div className="text-xl font-bold text-[#0d171b] dark:text-white">
                            {prediction.risk_change !== null ? `${((prediction.risk_change || 0) * 100).toFixed(1)}%` :"N/A"}
                        </div>

                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                        <h4 className="font-bold text-[#0d171b] dark:text-white mb-4">Price with SMA-20 & SMA-50 (90 trading days)</h4>
                        <PriceGraph
                            dates={prediction.charts?.dates || []}
                            price={prediction.charts?.price || []}
                            sma20={prediction.charts?.sma_20 || []}
                            sma50={prediction.charts?.sma_50 || []}
                        />
                    </div>
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                        <h4 className="font-bold text-[#0d171b] dark:text-white mb-4">Volatility (90 trading days)</h4>
                        <VolatilityChart
                            dates={prediction.charts?.dates || []}
                            volatility={prediction.charts?.volatility || []}
                        />
                    </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SellAdvice;
