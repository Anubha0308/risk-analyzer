import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
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
        `http://localhost:8000/predict/risk/${selectedStock}`,
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
        const response = await fetch("http://localhost:8000/me", {
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
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7f8",
        }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7f8",
        padding: "40px 20px",
      }}
    >
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}

      <div
        style={{
          maxWidth: isAuthenticated ? "1400px" : "1200px",
          width: "100%",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          padding: isAuthenticated ? "48px 56px" : "48px",
          borderRadius: "16px",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              color: "#0d171b",
              fontSize: "36px",
              fontWeight: "700",
              marginBottom: "8px",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Sell Advice
          </h1>
          <p style={{ color: "#4c809a", margin: 0, fontSize: "16px", fontFamily: "Manrope, sans-serif" }}>
            {symbol ? `ML-based risk and price trends for ${symbol}` : "AI-powered stock risk analysis"}
          </p>
        </div>

        {!isAuthenticated ? (
          <div>
            <div
              style={{
                padding: "32px",
                borderRadius: "12px",
                border: "2px dashed #cfdfe7",
                backgroundColor: "#f9fafb",
                textAlign: "center",
                marginBottom: "40px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "64px",
                  height: "64px",
                  borderRadius: "16px",
                  backgroundColor: "#13a4ec",
                  marginBottom: "20px",
                }}
              >
                <span className="material-symbols-outlined" style={{ color: "white", fontSize: "32px" }}>
                  lock
                </span>
              </div>
              <h2
                style={{
                  color: "#0d171b",
                  fontSize: "24px",
                  fontWeight: "700",
                  marginBottom: "12px",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Login Required
              </h2>
              <p
                style={{
                  color: "#4c809a",
                  fontSize: "16px",
                  marginBottom: "32px",
                  maxWidth: "600px",
                  margin: "0 auto 32px",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Sign in to access comprehensive AI-powered stock risk analysis and get detailed insights for {symbol || "your stocks"}.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <Link
                  to="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 24px",
                    borderRadius: "12px",
                    backgroundColor: "#13a4ec",
                    color: "white",
                    fontWeight: "700",
                    fontSize: "16px",
                    textDecoration: "none",
                    fontFamily: "Manrope, sans-serif",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = "#0f8ac4")}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = "#13a4ec")}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 24px",
                    borderRadius: "12px",
                    backgroundColor: "white",
                    color: "#13a4ec",
                    fontWeight: "700",
                    fontSize: "16px",
                    textDecoration: "none",
                    border: "2px solid #13a4ec",
                    fontFamily: "Manrope, sans-serif",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#f0f9ff";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "white";
                  }}
                >
                  Sign Up
                </Link>
              </div>
            </div>

            <div style={{ marginTop: "48px" }}>
              <h3
                style={{
                  color: "#0d171b",
                  fontSize: "22px",
                  fontWeight: "700",
                  marginBottom: "24px",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                What you'll get with full access:
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(239,68,68,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#ef4444", fontSize: "24px" }}>
                        warning
                      </span>
                    </div>
                    <h4
                      style={{
                        color: "#0d171b",
                        fontSize: "18px",
                        fontWeight: "700",
                        margin: 0,
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Risk Probability
                    </h4>
                  </div>
                  <p
                    style={{
                      color: "#4c809a",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      margin: 0,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    Get precise risk scores (0-100%) calculated using advanced ML models that analyze market volatility, price trends, and historical patterns.
                  </p>
                </div>

                <div
                  style={{
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(34,197,94,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#16a34a", fontSize: "24px" }}>
                        lightbulb
                      </span>
                    </div>
                    <h4
                      style={{
                        color: "#0d171b",
                        fontSize: "18px",
                        fontWeight: "700",
                        margin: 0,
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Detailed Reasons
                    </h4>
                  </div>
                  <p
                    style={{
                      color: "#4c809a",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      margin: 0,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    Understand the "why" behind each risk assessment with AI-generated explanations covering market conditions, technical indicators, and trend analysis.
                  </p>
                </div>

                <div
                  style={{
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(19,164,236,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#13a4ec", fontSize: "24px" }}>
                        show_chart
                      </span>
                    </div>
                    <h4
                      style={{
                        color: "#0d171b",
                        fontSize: "18px",
                        fontWeight: "700",
                        margin: 0,
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Price & Volatility Charts
                    </h4>
                  </div>
                  <p
                    style={{
                      color: "#4c809a",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      margin: 0,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    Visualize 90-day price trends with SMA-20 and SMA-50 indicators, plus volatility analysis to spot potential risk patterns.
                  </p>
                </div>

                <div
                  style={{
                    padding: "24px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(245,158,11,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "24px" }}>
                        trending_down
                      </span>
                    </div>
                    <h4
                      style={{
                        color: "#0d171b",
                        fontSize: "18px",
                        fontWeight: "700",
                        margin: 0,
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Sell Recommendations
                    </h4>
                  </div>
                  <p
                    style={{
                      color: "#4c809a",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      margin: 0,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    Receive actionable sell/hold recommendations based on risk levels (HIGH, MEDIUM, LOW) to protect your portfolio from potential losses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
                <p style={{ color: "#4c809a", fontSize: "16px", fontFamily: "Manrope, sans-serif" }}>
                  Analyzing {symbol}...
                </p>
              </div>
            )}

            {prediction && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "24px",
                    gridTemplateColumns: "1.5fr 1fr",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "20px",
                      }}
                    >
                      <div>
                        <div style={{ color: "#4c809a", fontSize: "14px", marginBottom: "4px", fontFamily: "Manrope, sans-serif" }}>
                          Symbol
                        </div>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: 700,
                            color: "#0d171b",
                            fontFamily: "Manrope, sans-serif",
                          }}
                        >
                          {prediction.symbol}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "8px 16px",
                          borderRadius: "9999px",
                          backgroundColor:
                            prediction.risk_level === "HIGH"
                              ? "rgba(239,68,68,0.12)"
                              : prediction.risk_level === "MEDIUM"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(34,197,94,0.12)",
                          color:
                            prediction.risk_level === "HIGH"
                              ? "#ef4444"
                              : prediction.risk_level === "MEDIUM"
                              ? "#d97706"
                              : "#16a34a",
                          fontWeight: 700,
                          fontSize: "14px",
                          fontFamily: "Manrope, sans-serif",
                        }}
                      >
                        {prediction.risk_level} RISK
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "20px",
                        padding: "16px",
                        borderRadius: "8px",
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#0d171b",
                          marginBottom: "12px",
                          fontSize: "16px",
                          fontFamily: "Manrope, sans-serif",
                        }}
                      >
                        Recommendation
                      </div>
                      <div style={{ color: "#374151", fontSize: "15px", lineHeight: "1.6", fontFamily: "Manrope, sans-serif" }}>
                        {prediction.recommendation}
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#0d171b",
                          marginBottom: "12px",
                          fontSize: "18px",
                          fontFamily: "Manrope, sans-serif",
                        }}
                      >
                        Why this assessment
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "24px",
                          color: "#374151",
                          lineHeight: 1.8,
                          fontSize: "15px",
                          fontFamily: "Manrope, sans-serif",
                        }}
                      >
                        {(prediction.reasons || []).map((reason, idx) => (
                          <li key={idx} style={{ marginBottom: "8px" }}>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RiskGauge value={(prediction.risk_score || 0) * 100} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                  }}
                >
                  <div
                    style={{
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#0d171b",
                        marginBottom: "16px",
                        fontSize: "18px",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Price with SMA-20 & SMA-50 (90 trading days)
                    </div>
                    <PriceGraph
                      dates={prediction.charts?.dates || []}
                      price={prediction.charts?.price || []}
                      sma20={prediction.charts?.sma_20 || []}
                      sma50={prediction.charts?.sma_50 || []}
                    />
                  </div>

                  <div
                    style={{
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#0d171b",
                        marginBottom: "16px",
                        fontSize: "18px",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      Volatility (90 trading days)
                    </div>
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
