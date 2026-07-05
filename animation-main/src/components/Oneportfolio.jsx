import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";
import { page, card, muted, btnPrimary, btnGhost, input, tableHead } from "../themeClasses";

function Oneportfolio() {
  const { id } = useParams();
  const [error, setError] = useState("");
  const [getting, setGetting] = useState(true);
  const [Portfolioname, setPortfolioname] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [newStockQuantity, setNewStockQuantity] = useState("");
  const [newStockPrice, setNewStockPrice] = useState("");
  const [newStockDate, setNewStockDate] = useState("");

  const navigate = useNavigate();

  const handleGetPortfolio = useCallback(async () => {
    const response = await fetch(`${backend_url}/get_portfolio/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
    const portfolio = await response.json();
    if (!response.ok) {
      setError(
        "Failed to fetch portfolio details: " +
          (portfolio.detail || portfolio.message || "Unknown error"),
      );
      setHoldings([]);
      setGetting(false);
      return;
    }
    setHoldings(Array.isArray(portfolio.holdings) ? portfolio.holdings : []);
    setPortfolioname(portfolio.name || "");
    setGetting(false);
  }, [id]);

  useEffect(() => {
    // Creating an isolated async block inside the effect
    // This explicitly signals to the linter that all state changes are asynchronous
    const startFetching = async () => {
      await handleGetPortfolio();
    };

    startFetching();
  }, [handleGetPortfolio]);

  const searchTickers = async (query) => {
    const res = await fetch(
      `${backend_url}/market/search?q=${encodeURIComponent(query)}&limit=6`,
      {
        headers: { Accept: "application/json" },
        credentials: "include",
      },
    );
    if (!res.ok) throw new Error("Failed to search tickers");
    const data = await res.json();
    return Array.isArray(data?.quotes) ? data.quotes : []; //this is returns the Array
  };

  const handlenewstock = async () => {
    //validate the input fields entered  by user
    if (
      !newStockSymbol ||
      !newStockQuantity ||
      !newStockPrice ||
      !newStockDate
    ) {
      setError("Please fill all the fields");
      return;
    }
    //we need to check if the ticker user entered is valid or not

    const rawInput = (newStockSymbol || "").trim();
    const compact = rawInput.replace(/\s/g, "").toUpperCase(); //here removing all spaces from input and converting to uppercase
    const isTickerLike = /^[A-Z0-9.\-^]+$/.test(compact);
    //Apple Inc. (AAPL)
    //match[1] returns AAPL(i.e inside parentheses wala)

    let sym = "";
    const match = rawInput.match(/\(([A-Za-z0-9.\-^]+)\)\s*$/);
    if (match) {
      sym = match[1].toUpperCase();
    }

    if (!sym && rawInput.length >= 2) {
      try {
        const results = await searchTickers(rawInput);
        if (results.length > 0) {
          const exactMatch = results.find(
            (item) => item.symbol.toUpperCase() === compact,
          );
          if (exactMatch) {
            sym = exactMatch.symbol.toUpperCase();
          } else if (!isTickerLike) {
            sym = results[0].symbol.toUpperCase();
          }
        }
      } catch {
        // ignore search failures and validate by raw ticker pattern below
      }
    }

    if (!sym && isTickerLike && rawInput.length >= 1) {
      try {
        const results = await searchTickers(rawInput);
        const exactMatch = results.find(
          (item) => item.symbol.toUpperCase() === compact,
        );
        if (exactMatch) {
          sym = exactMatch.symbol.toUpperCase();
        }
      } catch {
        // ignore
      }
    }

    if (!sym) {
      setError("Enter a valid ticker or company name.");
      setTimeout(() => setError(""), 4500);
      return;
    }

    if (
      isNaN(newStockQuantity) ||
      isNaN(newStockPrice) ||
      isNaN(Date.parse(newStockDate))
    ) {
      setError("Quantity, Price, and Date must be valid");
      return;
    }
    if (newStockDate > new Date().toISOString().split("T")[0]) {
      setError("Buy date cannot be in the future");
      return;
    }
    if (Number(newStockQuantity) <= 0 || Number(newStockPrice) <= 0) {
      setError("Quantity and Price must be greater than zero");
      return;
    }
    const response = await fetch(`${backend_url}/add_stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        //also  we need to send the portfolio id to backend to add the stock to the correct portfolio
        portfolioId: id,
        symbol: sym,
        quantity: Number(newStockQuantity),
        price: Number(newStockPrice),
        buyDate: newStockDate,
      }),
    });

    const result = await response.json();
    if (result.success) {
      setHoldings([...holdings, result.stock]);
      setNewStockSymbol("");
      setNewStockQuantity("");
      setNewStockPrice("");
      setNewStockDate("");
      setAdding(false);
    } else {
      setError("Failed to add stock: " + (result.detail || result.message));
    }
  };

  const handleDeleteStock = async (_id) => {
    const response = await fetch(`${backend_url}/delete_stock1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        portfolioId: id,
        stockId: _id,
      }),
    });
    const result = await response.json();
    if (result.success) {
      //remove from holdings
      setHoldings(holdings.filter((stock) => stock._id !== _id));
    } else {
      setError("Failed to delete stock: " + result.message);
    }
  };

  const handleEditStock = async (_id) => {
    //we will have the same form as adding a new stock but with prefilled values and also we will have a button to cancel the editing process
    setEditingId(_id);

    const stockToEdit = holdings.find((stock) => stock._id === _id);
    setNewStockSymbol(stockToEdit.symbol);
    setNewStockQuantity(stockToEdit.quantity);
    setNewStockPrice(stockToEdit.price);
    setNewStockDate(stockToEdit.buy_date || "");
  };

  const handleUpdateStock = async (_id) => {
    //validate
    if (isNaN(newStockQuantity) || isNaN(newStockPrice)) {
      setError("Quantity and Price must be numbers");
      return;
    }
    if (Number(newStockQuantity) <= 0 || Number(newStockPrice) <= 0) {
      setError("Quantity and Price must be greater than zero");
      return;
    }
    if (newStockDate > new Date().toISOString().split("T")[0]) {
      setError("Buy date cannot be in the future");
      return;
    }
    const response = await fetch(`${backend_url}/update_stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        portfolioId: id,
        stockId: _id,
        quantity: Number(newStockQuantity),
        price: Number(newStockPrice),
        buy_date: newStockDate,
      }),
    });
    const result = await response.json();
    if (result.success) {
      // Update the holdings list with the updated stock and reflect the changes in the UI
      setHoldings(
        holdings.map((stock) =>
          stock._id === _id
            ? {
                ...stock,
                quantity: Number(newStockQuantity),
                price: Number(newStockPrice),
                buyDate: newStockDate,
              }
            : stock,
        ),
      );
      setEditingId(null);
    } else {
      setError("Failed to update stock: " + result.message);
    }
  };
  //we have the portfolio holdings already in the frontend so maybe we can use that only for analyzing on backend
  const handleAnalyzePortfolio = async () => {
    const response = await fetch(`${backend_url}/analyze_portfolio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        portfolioId: id,
        name: Portfolioname,
        holdings: holdings,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(
        result.detail || result.message || "Failed to analyze portfolio",
      );
      return;
    }

    navigate(`/portfolio-analysis/${id}`, {
      state: {
        analysisData: result.resultData,
      },
    });
  };
  return (
    <div className={`${page} px-8 py-8`}>
      <div className="flex items-center justify-between mb-1 mt-2">
        <button onClick={() => navigate(-1)} className={btnGhost}>← Back</button>
        <button onClick={() => setAdding(true)} className={btnPrimary + " px-4 py-2"}>+ Add Stock</button>
      </div>
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}
      <div className={`max-w-6xl mx-auto ${card} flex flex-col items-center justify-center p-6`}>
        {getting ? (
          <div className={`${muted} text-lg`}>
            Loading portfolio details...
          </div>
        ) : holdings.length === 0 ? (
          <div className={`${muted} text-lg`}>
            No stocks in this portfolio.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 p-4">
            <table className="w-full text-left">
              <thead className={tableHead}>
                <tr>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Ticker</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Quantity</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Currency</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Buy Price</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Total</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">BuyDate</th>
                  <th className="p-3 border-b border-slate-200 dark:border-slate-700">Actions</th>
                </tr>
              </thead>

              <tbody>
                {holdings.map((stock) => (
                  <tr key={stock._id} className="text-[#0d171b] dark:text-white border-b border-slate-200 dark:border-slate-700">
                    <td className="p-3 font-semibold">
                      {stock.symbol}
                    </td>

                    <td className="p-3">
                      {editingId === stock._id ? (
                        <input
                          type="text"
                          className={`${input} px-2 py-1 w-24`}
                          value={newStockQuantity}
                          onChange={(e) => setNewStockQuantity(e.target.value)}
                        />
                      ) : (
                        stock.quantity
                      )}
                    </td>
                    <td className="p-3">
                      {stock.currency_type}
                      </td>
                    <td className="p-3">
                      {editingId === stock._id ? (
                        <input
                          type="text"
                          className={`${input} px-2 py-1 w-24`}
                          value={newStockPrice}
                          onChange={(e) => setNewStockPrice(e.target.value)}
                        />
                      ) : (
                        `${Number(stock.price).toFixed(2)}`
                      )}
                    </td>

                    <td className="p-3">
                      
                      {(Number(stock.quantity) * Number(stock.price)).toFixed(
                        2,
                      )}
                    </td>

                    <td className="p-3">
                      {editingId === stock._id ? (
                        <input
                          type="date"
                          className={`${input} px-2 py-1`}
                          value={newStockDate}
                          onChange={(e) => setNewStockDate(e.target.value)}
                        />
                      ) : (
                        stock.buy_date
                      )}
                    </td>

                    <td className="p-3">
                      {editingId === stock._id ? (
                        <div className="flex gap-2">
                          <button
                            className="bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 text-sm"
                            onClick={() => handleUpdateStock(stock._id)}
                          >
                            Save
                          </button>

                          <button
                            className="bg-slate-500 text-white px-3 py-1 rounded-lg hover:bg-slate-600 text-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className={btnGhost} onClick={() => handleEditStock(stock._id)}>
                            Edit
                          </button>

                          <button className="text-sm font-semibold text-red-600 dark:text-red-400 hover:opacity-80" onClick={() => handleDeleteStock(stock._id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <button
                onClick={handleAnalyzePortfolio}
                className={`${btnPrimary} mt-4 mb-4 px-5 py-2`}
              >
                Analyze Portfolio{" "}
              </button>
            </div>
          </div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 flex items-center justify-center z-50">
          <div className={`${card} p-6 w-80 max-w-[90vw]`}>
            <h2 className="text-xl font-bold mb-4 text-[#0d171b] dark:text-white">
              Add Stock to Portfolio
            </h2>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Stock Symbol"
                className={`${input} px-3 py-2 w-full`}
                value={newStockSymbol}
                onChange={(e) => setNewStockSymbol(e.target.value)}
              />

              <input
                type="text"
                placeholder="Quantity"
                className={`${input} px-3 py-2 w-full`}
                value={newStockQuantity}
                onChange={(e) => setNewStockQuantity(e.target.value)}
              />

              <input
                type="text"
                placeholder="Purchase Price"
                className={`${input} px-3 py-2 w-full`}
                value={newStockPrice}
                onChange={(e) => setNewStockPrice(e.target.value)}
              />
              <label htmlFor="start-date" className="text-[#0d171b] dark:text-white text-sm">
                BuyDate:
              </label>
              <input
                id="start-date"
                type="date"
                value={newStockDate}
                className={`${input} px-3 py-2 w-full`}
                onChange={(e) => setNewStockDate(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handlenewstock} className={`${btnPrimary} px-4 py-2 flex-1`}>Add</button>

              <button onClick={() => setAdding(false)} className={btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  //we have the id in the url in backend we have jwt token which has email and in the frontend we have id
}

export default Oneportfolio;
//display if portfolio is there or not and user can also add a new stock symbol to that portfolio and also delete the portfolio
//we have the user portfolio id and get the portfolio details from backend
