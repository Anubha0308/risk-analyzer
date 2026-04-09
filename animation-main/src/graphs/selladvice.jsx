import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { backend_url } from "../config.js";
import ErrorDisplay from "../components/ErrorDisplay.jsx";
import RiskGauge from "./riskgauge.jsx";
import PriceGraph from "./pricegraph.jsx";
import VolatilityChart from "./volatility.jsx";

const searchTickers = async (query) => {
  const res = await fetch(
    `${backend_url}/market/search?q=${encodeURIComponent(query)}&limit=6`,
    {
      headers: { Accept: "application/json" },
      credentials: "include",
    }
  );
  if (!res.ok) throw new Error("Failed to search tickers");
  const data = await res.json();
  return Array.isArray(data?.quotes) ? data.quotes : [];
};

function SellAdvice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [similarStocks, setSimilarStocks] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { symbol, name } = location.state || {};

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
        `${backend_url}/predict/risk/${encodeURIComponent(selectedStock)}`,
        {
          method: "GET",
          credentials: "include", // Important for cookies
        }
      );

      const data = await response.json();

      if (response.ok) {
        setPrediction(data);
        const fetchedName = data?.company_name || data?.companyName || data?.name;
        if (fetchedName) setDisplayName(fetchedName);
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

  const handleAnalyze = async () => {
    const raw = (searchValue || "").trim();
    let sym = (selectedSymbol || "").trim();
    let nm = selectedName || "";

    if (!sym) {
      const m = raw.match(/\(([A-Za-z0-9.\-^]+)\)\s*$/);
      if (m) sym = m[1].toUpperCase();
    }

    if (!sym && raw.length >= 2) {
      try {
        const results = await searchTickers(raw);
        if (results.length > 0) {
          sym = results[0].symbol;
          nm = results[0].name;
        }
      } catch {
        // ignore
      }
    }

    if (!sym && raw.length >= 1) {
      const compact = raw.replace(/\s/g, "").toUpperCase();
      if (/^[A-Z0-9.\-^]+$/.test(compact)) sym = compact;
    }

    if (!sym) {
      setError("Enter a valid ticker or choose a company from suggestions.");
      setTimeout(() => setError(""), 4500);
      return;
    }

    navigate("/selladvice", { state: { symbol: sym.toUpperCase(), name: nm || undefined } });
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
            setDisplayName(name || "");
            setSearchValue(name ? `${name} (${symbol})` : symbol);
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

  useEffect(() => {
    let cancelled = false;
    const q = searchValue.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const results = await searchTickers(q);
        if (!cancelled) {
          setSuggestions(results);
          setSuggestOpen(true);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestOpen(false);
        }
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchValue]);

  useEffect(() => {
    let cancelled = false;
    const loadSimilar = async () => {
      if (!isAuthenticated || !symbol) return;
      try {
        setSimilarLoading(true);
        const res = await fetch(`${backend_url}/market/similar/${encodeURIComponent(symbol)}`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSimilarStocks(Array.isArray(data?.similar) ? data.similar : []);
          if (!displayName && data?.name) setDisplayName(data.name);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    };
    loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, symbol, displayName]);

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
            {displayName || name || (symbol ? symbol.toUpperCase() : "Sell Advice")}
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
            <div className="mb-8">
              <div className="relative flex items-center group max-w-2xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#4c809a] group-focus-within:text-[#13a4ec] transition-colors">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setSelectedSymbol("");
                    setSelectedName("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                  placeholder="Search another company or ticker (e.g. Apple or AAPL)"
                  className="block w-full rounded-xl border-0 py-3.5 pl-11 pr-32 text-[#0d171b] shadow-sm ring-1 ring-inset ring-[#cfdfe7] placeholder:text-[#4c809a] focus:ring-2 focus:ring-inset focus:ring-[#13a4ec] bg-white dark:bg-slate-800/50 dark:text-white dark:ring-slate-600 sm:text-sm sm:leading-6 transition-all"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                  onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                />
                {suggestOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-lg overflow-hidden text-left">
                    {suggestLoading ? (
                      <div className="px-4 py-3 text-sm text-[#4c809a] dark:text-slate-400 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#13a4ec]" />
                        Searching…
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[#4c809a] dark:text-slate-400">No matches found.</div>
                    ) : (
                      suggestions.map((sug) => (
                        <button
                          key={sug.symbol}
                          type="button"
                          className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start justify-between gap-4"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedSymbol(sug.symbol);
                            setSelectedName(sug.name);
                            setSearchValue(`${sug.name} (${sug.symbol})`);
                            setSuggestOpen(false);
                            navigate("/selladvice", { state: { symbol: sug.symbol, name: sug.name } });
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#0d171b] dark:text-white truncate">{sug.name}</div>
                            <div className="text-xs text-[#4c809a] dark:text-slate-400 truncate">{sug.exchange}</div>
                          </div>
                          <div className="text-xs font-bold text-[#13a4ec] shrink-0">{sug.symbol}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <div className="absolute inset-y-0 right-1.5 flex py-1.5">
                  <button
                    onClick={handleAnalyze}
                    disabled={!selectedSymbol && !searchValue.trim()}
                    className="inline-flex items-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] disabled:bg-slate-300 disabled:cursor-not-allowed px-5 py-2 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 hover:shadow-lg transition-all"
                  >
                    Analyze
                  </button>
                </div>
              </div>
            </div>

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

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h4 className="font-bold text-[#0d171b] dark:text-white">Similar stocks</h4>
                    {similarLoading && (
                      <div className="text-xs text-[#4c809a] dark:text-slate-400 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#13a4ec]" />
                        Loading…
                      </div>
                    )}
                  </div>
                  {(!similarLoading && (similarStocks || []).length === 0) ? (
                    <div className="text-sm text-[#4c809a] dark:text-slate-400">
                      No similar stocks found right now.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(similarStocks || []).map((s) => (
                        <button
                          key={s.symbol}
                          type="button"
                          onClick={() => navigate("/selladvice", { state: { symbol: s.symbol, name: s.name } })}
                          className="text-left group relative flex flex-col overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/50 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md hover:ring-[#13a4ec]/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm text-[#4c809a] dark:text-slate-400">Symbol</div>
                              <div className="text-lg font-bold text-[#0d171b] dark:text-white truncate">
                                {s.symbol}
                              </div>
                              {s.name && (
                                <div className="text-xs text-[#4c809a] dark:text-slate-400 truncate mt-1">
                                  {s.name}
                                </div>
                              )}
                            </div>
                            <div className="text-[#13a4ec] opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="material-symbols-outlined">arrow_forward</span>
                            </div>
                          </div>
                          {s.reason && (
                            <div className="mt-3 text-xs text-[#4c809a] dark:text-slate-400">
                              {s.reason}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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
