//displays all the portfolios of the user

//only the portfolio's name

//get all the portfolios from the backend and display then in a grid

import React from "react";
import { FaRegEdit as RenameIcon } from "react-icons/fa";
import { FaCheck } from "react-icons/fa";
import { backend_url } from "../config";
import ErrorDisplay from "./ErrorDisplay";
import Instructions from "./Instructions";

import { useState, useEffect, useCallback } from "react";

import { useNavigate } from "react-router-dom";
import { page, card, muted, btnPrimary, btnGhost, input } from "../themeClasses";

function Portfolios() {
  const navigate = useNavigate();

  const [portfolios, setPortfolios] = useState([]);

  const [fetching, setFetching] = useState(true);

  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");

  const [rename, setRename] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  

  const getPortFolios = useCallback(async () => {
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
      setFetching(false);
      setPortfolios([]);

      setError("Network error while loading portfolios");
    }
  },[]);

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
      await getPortFolios();
    };
    init();
  }, [getPortFolios]);

  
  return (
    <>
      {adding ? (
        <div className={`fixed inset-0 bg-slate-50 dark:bg-black/60 flex items-center justify-center z-50 ${page}`}>
          {error && (
            <ErrorDisplay message={error} onClose={() => setError("")} />
          )}
          <div className={`${card} p-6 flex flex-col items-center shadow-xl max-w-md w-full mx-4`}>
            <h2 className="text-2xl font-bold mb-6 text-[#0d171b] dark:text-white">
              Create New Portfolio
            </h2>

            <div className="flex flex-col gap-4 w-full">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Portfolio Name"
                className={`${input} p-3 w-full`}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => handleCreatePortfolio(name)}
                  className={`${btnPrimary} px-4 py-2 flex-1`}
                >
                  Create
                </button>

                <button
                  onClick={() => {
                    setAdding(false);
                    setName("");
                  }}
                  className={`${btnGhost} px-4 py-2`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${page} px-8 py-8`}>
          {error && (
            <ErrorDisplay message={error} onClose={() => setError("")} />
          )}
          <div className="flex items-center justify-between mb-1 mt-2">
            <button onClick={() => navigate(-1)} className={btnGhost}>← Back</button>
            <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-[#13a4ec] rounded-full text-center text-white text-sm cursor-pointer" onClick={() => setShowInstructions(true)}>?</div> 
            <button onClick={() => setAdding(true)} className={btnPrimary + " px-4 py-2"}>+ New Portfolio</button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="mb-4">
              <p className="text-4xl font-bold text-[#0d171b] dark:text-white">My Portfolios</p>

              <p className={`${muted} mt-1`}>
                Manage and analyze your investment portfolios
              </p>
            </div>
            {fetching ? (
              <div className={`${muted} text-center mt-20`}>
                Loading portfolios...
              </div>
            ) : portfolios.length === 0 ? (
                <div className={`${muted} text-center mt-20`}>
                  No portfolios found. Create your first portfolio to get started!
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio._id}
                    className={`${card} p-6 cursor-pointer hover:ring-[#13a4ec]/40 transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        {renamingId === portfolio._id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className={`${input} p-2 w-full`}
                              placeholder={portfolio.name}
                              value={rename}
                              onChange={(e) => setRename(e.target.value)}
                            />
                            <FaCheck
                              className="text-emerald-600 dark:text-emerald-400 mt-2 hover:text-emerald-500 transition-all cursor-pointer"
                              onClick={() => handlerenamesave()}
                            />
                          </div>
                        ) : (
                          <h3 className="text-xl font-bold text-[#0d171b] dark:text-white">
                            {portfolio.name}
                          </h3>
                        )}
                        <span>
                          <RenameIcon
                            className={`${muted} mt-2 hover:text-[#13a4ec] transition-all cursor-pointer`}
                            onClick={() => {
                              handleRename(portfolio._id, portfolio.name);
                            }}
                          />
                        </span>
                        <p
                          className={`${muted} text-sm mt-2 cursor-pointer hover:text-[#13a4ec]`}
                          onClick={() =>
                            navigate(`/Oneportfolio/${portfolio._id}`)
                          }
                        >
                          Click to view portfolio
                        </p>
                      </div>

                      <div className="w-12 h-12 rounded-full bg-[#13a4ec]/20 flex items-center justify-center text-[#13a4ec] text-xl">
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
        
        <div className="min-h-screen fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm px-8 py-8 flex items-center justify-center z-50">
          <Instructions />
          <button
            className={`absolute top-4 right-4 ${btnGhost} light:text-white dark:text-black`}
            onClick={() => setShowInstructions(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </>
  );
}

export default Portfolios;
