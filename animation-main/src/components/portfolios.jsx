//displays all the portfolios of the user

//only the portfolio's name

//get all the portfolios from the backend and display then in a grid

import React from "react";
import { FaRegEdit as RenameIcon } from "react-icons/fa";
import { FaCheck } from "react-icons/fa";
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";

import { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";

function Portfolios() {
  const navigate = useNavigate();

  const [portfolios, setPortfolios] = useState([]);

  const [fetching, setFetching] = useState(true);

  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");

  const [rename, setRename] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${backend_url}/me`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const isAuthorized = response.ok;
      setAuthorized(isAuthorized);
      return isAuthorized;
    } catch {
      setAuthorized(false);
      return false;
    }
  };

  const getPortFolios = async () => {
    setFetching(true);

    setError("");

    try {
      const response = await fetch(`${backend_url}/get_portfolios`, {
        method: "GET",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        setPortfolios([]);

        setError(
          result.detail || result.message || "Failed to load portfolios",
        );

        return;
      }

      const list = Array.isArray(result)
        ? result
        : Array.isArray(result.portfolios)
          ? result.portfolios
          : [];

      setPortfolios(list);
      setFetching(false);
    } catch {
      setPortfolios([]);

      setError("Network error while loading portfolios");
    }
  };

  const handleCreatePortfolio = async (portfolioName) => {
    if (!portfolioName.trim()) return setError("Enter portfolio name");

    if (portfolioName.length > 20)
      return setError("Portfolio name should be less than 20 characters");

    const response = await fetch(`${backend_url}/create_portfolio`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({ name: portfolioName }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.detail || result.message || "Failed to create portfolio");

      return;
    }

    setAdding(false);

    setName("");

    getPortFolios();
  };

  const handleRename = (portfolioId, currentName) => {
    setRename(currentName);
    setRenamingId(portfolioId);
  };

  const handlerenamesave = async () => {
    if (!rename.trim()) return setError("Enter portfolio name");

    const response = await fetch(`${backend_url}/rename_portfolio`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ id: renamingId, name: rename }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.detail || result.message || "Failed to rename portfolio");
      return;
    }

    setRename("");
    setRenamingId(null);
    getPortFolios();
  };

  useEffect(() => {
    const init = async () => {
      const isAuth = await checkAuth();
      if (isAuth) {
        getPortFolios();
      } else {
        setFetching(false);
      }
    };
    init();
  }, []);

  const Instructions = () => (
    <div className="max-w-7xl mx-auto mt-20 text-center p-6 rounded-lg bg-[#0d171b] border border-[#4c5f8e]">
      <h3 className="text-3xl font-bold text-[#0d171b] dark:text-white mb-10">
        Portfolio Analysis Features:
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {[
          {
            title: "Create Your Portfolio",
            description:
              "Easily build your investment portfolio by giving unique names to your portfolios.",
            icon: "add",
            color: "green",
          },
          {
            title: "Add stocks to Portfolio",
            description:
              "Add stocks to your portfolio by searching for stock symbols and selecting the desired stock from the search results.",
            icon: "show_chart",
            color: "amber",
          },
          {
            title: "Analyze Portfolio",
            description:
              "Analyze your portfolio's performance with detailed insights on total value, profit/loss, risk score and more.",
            icon: "lightbulb",
            color: "green",
          },
          {
            title: "See Optimized Portfolio Recommendations",
            description:
              "Get personalized portfolio optimization recommendations based on your current holdings and market trends to maximize returns and minimize risks.",
            icon: "recommend",
            color: "amber",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700"
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-${item.color}-500/15 text-${item.color}-500`}
              >
                <span className="material-symbols-outlined text-2xl">
                  {item.icon}
                </span>
              </div>
              <h4 className="text-lg font-bold text-[#0d171b] dark:text-white">
                {item.title}
              </h4>
            </div>
            <p className="text-sm text-[#4c809a] dark:text-slate-400 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <>
      {adding ? (
        <div className="fixed inset-0 bg-[#0f1727] flex items-center justify-center">
          {error && (
            <ErrorDisplay message={error} onClose={() => setError("")} />
          )}
          <div className="bg-[#0d171b] border border-[#4c5f8e] p-6 rounded-2xl flex flex-col items-center shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-white">
              Create New Portfolio
            </h2>

            <div className="flex flex-col gap-4 w-full">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Portfolio Name"
                className="bg-[#0f1727] border border-[#4c5f8e] p-3 rounded-lg text-white placeholder-gray-400 outline-none focus:border-[#13a3ea]"
              />

              <div className="flex gap-3">
                <button onClick={() => handleCreatePortfolio(name)}>
                  Create
                </button>

                <button
                  onClick={() => {
                    setAdding(false);
                    setName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !authorized ? (
        <div className="min-h-screen dark:bg-[#0d171b]/95 backdrop-blur-md px-8 py-8">
          <div className="flex items-center justify-between mb-6 mt-2">
            <button onClick={() => navigate(-1)}>← Back</button>
          </div>
          <Instructions />
        </div>
      ) : (
        <div className="min-h-screen dark:bg-[#0d171b]/95 backdrop-blur-md px-8 py-8">
          {error && (
            <ErrorDisplay message={error} onClose={() => setError("")} />
          )}
          <div className="flex items-center justify-between mb-1 mt-2">
            <button onClick={() => navigate(-1)}>← Back</button>
            <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-[#13a3ea] rounded-full" onClick={() => setShowInstructions(true)}>?</div> 
            <button onClick={() => setAdding(true)}>+ New Portfolio</button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="mb-4">
              <p className="text-4xl font-bold text-white">My Portfolios</p>

              <p className="text-gray-400 mt-1">
                Manage and analyze your investment portfolios
              </p>
            </div>
            {fetching ? (
              <div className="text-white text-center mt-20">
                Loading portfolios...
              </div>
            ) : portfolios.length === 0 ? (
                <div className="text-white text-center mt-20">
                  No portfolios found. Create your first portfolio to get started!
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio._id}
                    className="bg-[#0d171b] border border-[#4c5f8e] rounded-2xl p-6 cursor-pointer hover:border-[#13a3ea] hover:-translate-y-1 transition-all duration-200 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        {renamingId === portfolio._id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="bg-[#0f1727] border border-[#4c5f8e] p-2 rounded-lg text-white placeholder-gray-400 outline-none focus:border-[#13a3ea]"
                              placeholder={portfolio.name}
                              value={rename}
                              onChange={(e) => setRename(e.target.value)}
                            />
                            <FaCheck
                              className="text-green-400 mt-2 hover:text-green-500 transition-all cursor-pointer"
                              onClick={(e) => handlerenamesave()}
                            />
                          </div>
                        ) : (
                          <h3 className="text-xl font-bold text-white">
                            {portfolio.name}
                          </h3>
                        )}
                        <span>
                          <RenameIcon
                            className="text-gray-400 mt-2 hover:text-[#13a3ea] transition-all cursor-pointer"
                            onClick={(e) => {
                              handleRename(portfolio._id, portfolio.name);
                            }}
                          />
                        </span>
                        <p
                          className="text-gray-300 text-sm mt-2"
                          onClick={() =>
                            navigate(`/Oneportfolio/${portfolio._id}`)
                          }
                        >
                          Click to view portfolio
                        </p>
                      </div>

                      <div className="w-12 h-12 rounded-full bg-[#13a3ea]/20 flex items-center justify-center text-[#13a3ea] text-xl">
                        📊
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )
            }
          </div>
        </div>
      )}
      {showInstructions && (
        
        <div className="min-h-screen fixed inset-0 bg-transparent backdrop-blur-xs px-8 py-8 flex items-center justify-center z-50">
          {/* backdrop-blur and whatever is in the background should remain visible but blurred out */}
          <Instructions />
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-all"
            onClick={() => setShowInstructions(false)}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

export default Portfolios;
