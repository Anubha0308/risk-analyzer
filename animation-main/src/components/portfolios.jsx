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
  const [renaming, setRenaming] = useState(false);

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
    } catch {
      setPortfolios([]);

      setError("Network error while loading portfolios");
    } finally {
      setFetching(false);
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

  const handleRename = async (portfolioId, currentName) => {
    setRenaming(true);
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

    setRenaming(false);
    setRename("");
    setRenamingId(null);
    getPortFolios();
  };

  useEffect(() => {
    getPortFolios();
  }, []);

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
      ) : (
        <div className="min-h-screen dark:bg-[#0d171b]/95 backdrop-blur-md px-8 py-8">
          {error && (
            <ErrorDisplay message={error} onClose={() => setError("")} />
          )}
          {/* Top Header */}
          <div className="flex items-center justify-between mb-1 mt-2">
            <button onClick={() => navigate(-1)}>← Back</button>
            <button onClick={() => setAdding(true)}>+ New Portfolio</button>
          </div>
          {/* Loading */}
          {fetching ? (
            <div className="text-center text-gray-400 mt-20 text-lg">
              Fetching portfolios...
            </div>
          ) : portfolios.length === 0 ? (
            <div className="text-center text-gray-400 mt-20 text-lg">
              No portfolios found.
            </div>
          ) : (
            <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="mb-4">
              <p className="text-4xl font-bold text-white">My Portfolios</p>

              <p className="text-gray-400 mt-1">
                Manage and analyze your investment portfolios
              </p>
            </div>
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
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default Portfolios;
