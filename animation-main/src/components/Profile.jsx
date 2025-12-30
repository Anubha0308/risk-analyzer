import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const Header = () => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d171b]/95 backdrop-blur-md">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13a4ec]/10 text-[#13a4ec] ring-1 ring-[#13a4ec]/20">
              <span className="material-symbols-outlined text-xl">candlestick_chart</span>
            </div>
            <span
              className="text-xl font-bold tracking-tight text-[#0d171b] dark:text-white"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              RiskAI
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/market-overview"
            className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Market Overview
          </Link>
          <Link
            to="/about"
            className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            About
          </Link>
        </nav>
      </div>
    </div>
  </header>
);

const WatchlistCard = ({ symbol, onRemove, isEditing }) => {
  const cardContent = (
    <div className="group relative flex items-center justify-between overflow-hidden rounded-xl bg-white dark:bg-slate-800/50 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all duration-300 hover:shadow-lg hover:ring-[#13a4ec]/50">
      <div className="flex flex-col">
        <h3 className="text-lg font-bold text-[#0d171b] dark:text-white leading-tight">
          {symbol}
        </h3>
      </div>

      {isEditing ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(symbol);
          }}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      ) : (
        <span className="text-sm font-semibold text-[#13a4ec] opacity-0 group-hover:opacity-100 transition-opacity">
          Analyze
        </span>
      )}
    </div>
  );

  // ⛔ While editing → NOT clickable
  if (isEditing) return cardContent;

  // ✅ Normal mode → clickable
  return (
    <Link
      to="/selladvice"
      state={{ symbol }}
      className="block"
    >
      {cardContent}
    </Link>
  );
};


function Profile() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFullName, setEditedFullName] = useState("");
  const [editedWatchlist, setEditedWatchlist] = useState([]);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("http://localhost:8000/profile", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        setEditedFullName(data.full_name || "");
        setEditedWatchlist(data.watchlist || []);
      } else if (response.status === 401) {
        // Not logged in
        setUserData(null);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || "Failed to load profile");
      }
    } catch (err) {
      setError("Network error. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!userData) return;
    setIsEditing(true);
    setEditedFullName(userData.full_name || "");
    setEditedWatchlist(userData.watchlist || []);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (!userData) return;
    setEditedFullName(userData.full_name || "");
    setEditedWatchlist(userData.watchlist || []);
    setNewStockSymbol("");
  };

  const handleAddStock = () => {
    const symbol = newStockSymbol.trim().toUpperCase();
    if (!symbol) return;
    if (editedWatchlist.includes(symbol)) return;
    setEditedWatchlist([...editedWatchlist, symbol]);
    setNewStockSymbol("");
  };

  const handleRemoveStock = (symbol) => {
    setEditedWatchlist(editedWatchlist.filter((s) => s !== symbol));
  };

  const handleSave = async () => {
    try{
      setSaving(true);
      setError("");
      const response = await fetch("http://localhost:8000/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          full_name: editedFullName,
          watchlist: editedWatchlist,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setUserData(updated);
        setIsEditing(false);
        setNewStockSymbol("");
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || "Failed to save changes");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:8000/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      // Ignore error; just navigate away
      console.error("Logout error:", err);
    } finally {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div
        className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col antialiased"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <Header />
        <main className="grow flex items-center justify-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
          </div>
        </main>
      </div>
    );
  }

  // Not logged in
  if (!userData) {
    return (
      <div
        className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col antialiased"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <Header />
        <main className="grow flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold text-[#0d171b] dark:text-white mb-4">
              Login to access profile
            </h1>
            <p className="text-[#4c809a] dark:text-slate-400 mb-6">
              Please log in to view and manage your profile.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all"
            >
              Go to Login
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col antialiased"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <Header />
      <main className="grow p-6 sm:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-[#0d171b] dark:text-white mb-2">User Profile</h1>
            <p className="text-[#4c809a] dark:text-slate-400 text-lg">
              Manage your account details and view your activity.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* User Information Section */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 mb-10">
            <h2 className="text-2xl font-bold mb-6">Account Information</h2>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-[#4c809a] dark:text-slate-400">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedFullName}
                    onChange={(e) => setEditedFullName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border-0 py-2 px-3 text-[#0d171b] shadow-sm ring-1 ring-inset ring-[#cfdfe7] placeholder:text-[#4c809a] focus:ring-2 focus:ring-inset focus:ring-[#13a4ec] bg-white dark:bg-slate-700 dark:text-white dark:ring-slate-600 sm:text-sm"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="mt-1 text-lg font-medium text-[#0d171b] dark:text-white">
                    {userData.full_name || "Not set"}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-[#4c809a] dark:text-slate-400">Email Address</label>
                <p className="mt-1 text-lg font-medium text-[#0d171b] dark:text-white">{userData.email}</p>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] disabled:bg-slate-300 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-bold text-[#0d171b] dark:text-white transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex items-center justify-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all"
                >
                  Edit Profile
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/20 transition-all ml-auto"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Bookmarked Stocks Section */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 mb-10">
            <h2 className="text-2xl font-bold mb-6">Bookmarked Stocks</h2>
            {isEditing && (
              <div className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={newStockSymbol}
                  onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
                  placeholder="Enter stock symbol (e.g. AAPL)"
                  className="flex-1 rounded-lg border-0 py-2 px-3 text-[#0d171b] shadow-sm ring-1 ring-inset ring-[#cfdfe7] placeholder:text-[#4c809a] focus:ring-2 focus:ring-inset focus:ring-[#13a4ec] bg-white dark:bg-slate-700 dark:text-white dark:ring-slate-600 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddStock}
                  className="inline-flex items-center justify-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all"
                >
                  Add Stock
                </button>
              </div>
            )}
            {editedWatchlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editedWatchlist.map((symbol) => (
                  <WatchlistCard
                    key={symbol}
                    symbol={symbol}
                    onRemove={handleRemoveStock}
                    isEditing={isEditing}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
                <p className="text-[#4c809a] dark:text-slate-400">
                  {isEditing ? "Add stocks to your watchlist" : "Your watchlist is empty."}
                </p>
              </div>
            )}
          </div>

          {/* Recently Viewed Stocks Section */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Recently Viewed Stocks</h2>
            {userData.recently_viewed && userData.recently_viewed.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userData.recently_viewed.map((stock) => (
                  <Link
                    key={stock}
                    to="/selladvice"
                    state={{ symbol: stock }}
                    className="group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-800/50 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all duration-300 hover:shadow-lg hover:ring-[#13a4ec]/50 dark:hover:ring-[#13a4ec]/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-[#0d171b] dark:text-white leading-tight">
                          {stock}
                        </h3>
                      </div>
                      <span className="text-sm font-semibold text-[#13a4ec] opacity-0 group-hover:opacity-100 transition-opacity">
                        Analyze
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-6 bg-white dark:bg-slate-800/50 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
                <p className="text-[#4c809a] dark:text-slate-400">
                  You haven't viewed any stocks yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Profile;