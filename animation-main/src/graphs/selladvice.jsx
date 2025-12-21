import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ErrorDisplay from "../components/ErrorDisplay.jsx";

function SellAdvice() {
  const [selectedStock, setSelectedStock] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const navigate = useNavigate();

  const stocks = [
    { value: "AAPL", label: "Apple Inc. (AAPL)" },
    { value: "MSFT", label: "Microsoft (MSFT)" },
    { value: "RELIANCE.NS", label: "Reliance Industries (RELIANCE)" },
    { value: "GOOGL", label: "Alphabet (GOOGL)" },
    { value: "AMZN", label: "Amazon (AMZN)" },
    { value: "TSLA", label: "Tesla (TSLA)" },
    { value: "META", label: "Meta (META)" },
    { value: "NVDA", label: "NVIDIA (NVDA)" },
  ];

  const handlePredict = async () => {
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
        <h1
          style={{
            color: "#3d4453ff",
            fontSize: "28px",
            fontWeight: "600",
            marginBottom: "30px",
            textAlign: "center",
          }}
        >
          Sell Advice
        </h1>

        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="stock-select"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#3d4453ff",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Select Stock
          </label>
          <select
            id="stock-select"
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              border: "1px solid #a8a4abff",
              borderRadius: "6px",
              backgroundColor: "#f7f9fbff",
              color: "#3d4453ff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <option value="">Choose a stock...</option>
            {stocks.map((stock) => (
              <option key={stock.value} value={stock.value}>
                {stock.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading || !selectedStock}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            fontWeight: "500",
            backgroundColor: loading || !selectedStock ? "#a8a4abff" : "#13a4ecff",
            color: "#f3f9ffff",
            border: "none",
            borderRadius: "6px",
            cursor: loading || !selectedStock ? "not-allowed" : "pointer",
            marginBottom: "20px",
          }}
        >
          {loading ? "Analyzing..." : "Get Prediction"}
        </button>

        {prediction && (
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              backgroundColor: "#f7f9fbff",
              borderRadius: "8px",
              border: "1px solid #a8a4abff",
            }}
          >
            <h2
              style={{
                color: "#3d4453ff",
                fontSize: "20px",
                marginBottom: "15px",
              }}
            >
              {prediction.symbol} Analysis
            </h2>
            <div style={{ marginBottom: "10px" }}>
              <span style={{ color: "#3d4453ff", fontWeight: "500" }}>
                Risk Score:{" "}
              </span>
              <span style={{ color: "#3d4453ff" }}>
                {(prediction.risk_score * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <span style={{ color: "#3d4453ff", fontWeight: "500" }}>
                Risk Level:{" "}
              </span>
              <span
                style={{
                  color:
                    prediction.risk_level === "HIGH"
                      ? "#ff0000"
                      : prediction.risk_level === "MEDIUM"
                      ? "#ffa500"
                      : "#00aa00",
                  fontWeight: "600",
                }}
              >
                {prediction.risk_level}
              </span>
            </div>
            <div>
              <span style={{ color: "#3d4453ff", fontWeight: "500" }}>
                Recommendation:{" "}
              </span>
              <span style={{ color: "#3d4453ff" }}>
                {prediction.recommendation}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SellAdvice;