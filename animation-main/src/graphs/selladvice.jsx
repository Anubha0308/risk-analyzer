import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ErrorDisplay from "../components/ErrorDisplay.jsx";
import RiskGauge from "./riskgauge.jsx";
import PriceGraph from "./pricegraph.jsx";
import VolatilityChart from "./volatility.jsx";

function SellAdvice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { symbol } = location.state || {};

  useEffect(() => {
    if (symbol) {
      handlePredict(symbol);
    } else {
      setError("No stock symbol provided. Please go to the homepage to select a stock.");
    }
  }, [symbol]);

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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f2f3ff",
        padding: "20px",
      }}
    >
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}

      <div
        style={{
          maxWidth: "600px",
          width: "100%",
          backgroundColor: "#ffffff",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h1
              style={{
                color: "#3d4453ff",
                fontSize: "28px",
                fontWeight: "600",
                marginBottom: "8px",
              }}
            >
              Sell Advice
            </h1>
            <p style={{ color: "#6b7280", margin: 0 }}>
              ML-based risk and price trends for {symbol}.
            </p>
          </div>
        </div>

        {loading && (
            <div style={{ textAlign: 'center', margin: '20px' }}>Analyzing...</div>
        )}

        {prediction && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "1.2fr 1fr",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: "13px" }}>Symbol</div>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>
                      {prediction.symbol}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
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
                    }}
                  >
                    {prediction.risk_level}
                  </div>
                </div>

                <div style={{ marginTop: "12px", color: "#374151" }}>
                  {prediction.recommendation}
                </div>

                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: "8px" }}>
                    Why this assessment
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", lineHeight: 1.5 }}>
                    {(prediction.reasons || []).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#fff",
                }}
              >
                <RiskGauge value={(prediction.risk_score || 0) * 100} />
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
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
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
                Volatility (90 trading days)
              </div>
              <VolatilityChart
                dates={prediction.charts?.dates || []}
                volatility={prediction.charts?.volatility || []}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SellAdvice;
