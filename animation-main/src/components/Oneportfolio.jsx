import React from "react";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";

function Oneportfolio() {
  const { id } = useParams();
  const [error, setError] = useState("");
  const [getting, setGetting] = useState(false);
  const [Portfolioname, setPortfolioname] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [newStockQuantity, setNewStockQuantity] = useState("");
  const [newStockPrice, setNewStockPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [newStockDate, setNewStockDate] = useState("");

  const navigate = useNavigate();

  const handleGetPortfolio = async () => {
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
  };

  useEffect(() => {
    //fetch the portfolio details from backend using the id and set the holdings and portfolio name
    setGetting(true);
    handleGetPortfolio();
  }, [id]); // if dependency is none then it will run only once , but if in url id changes then not that's why id dependency is there

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
      return Array.isArray(data?.quotes) ? data.quotes : [];//this is returns the Array
  };

  const handlenewstock = async () => {
    //validate the input fields entered  by user
    setIsSubmitting(true);
    if (
      !newStockSymbol ||
      !newStockQuantity ||
      !newStockPrice ||
      !newStockDate
    ) {
      setError("Please fill all the fields");
      setIsSubmitting(false);
      return;
    }
    //we need to check if the ticker user entered is valid or not 

    const rawInput = (newStockSymbol || "").trim();
    const compact = rawInput.replace(/\s/g, "").toUpperCase();//here removing all spaces from input and converting to uppercase
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
      setIsSubmitting(false);
      return;
    }

    if (
      isNaN(newStockQuantity) ||
      isNaN(newStockPrice) ||
      isNaN(Date.parse(newStockDate))
    ) {
      setError("Quantity, Price, and Date must be valid");
      setIsSubmitting(false);
      return;
    }
    if (newStockDate > new Date().toISOString().split("T")[0]) {
      setError("Buy date cannot be in the future");
      setIsSubmitting(false);
      return;
    }
    if (Number(newStockQuantity) <= 0 || Number(newStockPrice) <= 0) {
      setError("Quantity and Price must be greater than zero");
      setIsSubmitting(false);
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
    setIsSubmitting(false);
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
    setNewStockDate(stockToEdit.buyDate || "");
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
    setAnalysing(true);
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
      setAnalysing(false);
      return;
    }
    setAnalysing(false);

    navigate(`/portfolio-analysis/${id}`, {
      state: {
        analysisData: result.resultData,
      },
    });
  };
  return (
    <div className="min-h-screen bg-[#0d171b]/95 backdrop-blur-md text-white px-8 py-8 ">
      <div className="flex items-center justify-between mb-1 mt-2">
        <button onClick={() => navigate(-1)}>← Back</button>
        <button onClick={() => setAdding(true)}>+ Add Stock</button>
      </div>
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}
      <div className="max-w-6xl mx-auto bg-[#0d171b] rounded-lg shadow flex flex-col items-center justify-center">
        {getting ? (
          <div className="text-gray-400 text-lg">Loading portfolio details...</div>
        ) : holdings.length === 0 ? (
          <div className="text-gray-400 text-lg">No stocks in this portfolio.</div>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border border-gray-700 p-4">
            <table className="w-full border border-gray-200 text-left">
              <thead className="bg-gray-100 text-black font-semibold">
                <tr>
                  <th className="p-3 border-b">Ticker</th>
                  <th className="p-3 border-b">Quantity</th>
                  <th className="p-3 border-b">Buy Price</th>
                  <th className="p-3 border-b">Total</th>
                  <th className="p-3 border-b">BuyDate</th>
                  <th className="p-3 border-b">Actions</th>
                </tr>
              </thead>

              <tbody>
                {holdings.map((stock) => (
                  <tr key={stock._id} className=" text-white">
                    <td className="p-3 border-b font-semibold">
                      {stock.symbol}
                    </td>

                    <td className="p-3 border-b">
                      {editingId === stock._id ? (
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-24"
                          value={newStockQuantity}
                          onChange={(e) => setNewStockQuantity(e.target.value)}
                        />
                      ) : (
                        stock.quantity
                      )}
                    </td>

                    <td className="p-3 border-b">
                      {editingId === stock._id ? (
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-24"
                          value={newStockPrice}
                          onChange={(e) => setNewStockPrice(e.target.value)}
                        />
                      ) : (
                        `$${Number(stock.price).toFixed(2)}`
                      )}
                    </td>

                    <td className="p-3 border-b">
                      $
                      {(Number(stock.quantity) * Number(stock.price)).toFixed(
                        2,
                      )}
                    </td>

                    <td className="p-3 border-b">
                      {editingId === stock._id ? (
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={newStockDate}
                          onChange={(e) => setNewStockDate(e.target.value)}
                        />
                      ) : (
                        stock.buy_date
                      )}
                    </td>

                    <td className="p-3 border-b">
                      {editingId === stock._id ? (
                        <div className="flex gap-2">
                          <button
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                            onClick={() => handleUpdateStock(stock._id)}
                          >
                            Save
                          </button>

                          <button
                            className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleEditStock(stock._id)}>
                            Edit
                          </button>

                          <button onClick={() => handleDeleteStock(stock._id)}>
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
                className="mt-4 ml-0.5 mb-4"
              >
                Analyze Portfolio{" "}
              </button>
            </div>
          </div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-[#0d171b] p-6 rounded-lg shadow-lg w-80">
            <h2 className="text-xl font-bold mb-4 text-white">
              Add Stock to Portfolio
            </h2>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Stock Symbol"
                className="border border-gray-300 rounded px-3 py-2 text-white"
                value={newStockSymbol}
                onChange={(e) => setNewStockSymbol(e.target.value)}
              />

              <input
                type="text"
                placeholder="Quantity"
                className="border border-gray-300 rounded px-3 py-2 text-white"
                value={newStockQuantity}
                onChange={(e) => setNewStockQuantity(e.target.value)}
              />

              <input
                type="text"
                placeholder="Purchase Price"
                className="border border-gray-300 rounded px-3 py-2 text-white"
                value={newStockPrice}
                onChange={(e) => setNewStockPrice(e.target.value)}
              />
              <label htmlFor="start-date" className="text-white">
                BuyDate:
              </label>
              <input
                id="start-date"
                type="date"
                value={newStockDate}
                className="border border-gray-300 rounded px-3 py-2 text-white"
                onChange={(e) => setNewStockDate(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handlenewstock}>Add</button>

              <button onClick={() => setAdding(false)}>Cancel</button>
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
