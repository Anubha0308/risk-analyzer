import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d171b]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13a4ec]/10 text-[#13a4ec] ring-1 ring-[#13a4ec]/20">
                    <span className="material-symbols-outlined text-xl">candlestick_chart</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-[#0d171b] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
                    RiskAI
                </span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/market-overview" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              Market Overview
            </Link>
            <Link to="/about" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/profile"
              className="flex items-center justify-center rounded-lg bg-[#0d171b] dark:bg-slate-800 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#1a2830] dark:hover:bg-slate-700 transition-all"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Profile
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

// For demonstration, using a placeholder. In a real app, this might come from props or context.
const recentlyViewedStocks = [
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
];

const StockCard = ({ symbol, name }) => (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-800/50 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all duration-300">
        <div className="flex items-start justify-between">
            <div className="flex flex-col">
                <h3 className="text-lg font-bold text-[#0d171b] dark:text-white leading-tight">{symbol}</h3>
                <p className="text-xs text-[#4c809a] dark:text-slate-400 mt-0.5">{name}</p>
            </div>
            <Link to={`/selladvice`} state={{ symbol: symbol }} className="text-sm font-semibold text-[#13a4ec] opacity-0 group-hover:opacity-100 transition-opacity">
                Analyze
            </Link>
        </div>
    </div>
);


function Profile() {
  return (
    <div 
      className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col antialiased"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <Header />
      <main className="flex-grow p-6 sm:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-[#0d171b] dark:text-white mb-2">
              User Profile
            </h1>
            <p className="text-[#4c809a] dark:text-slate-400 text-lg">
              Manage your account details and view your activity.
            </p>
          </div>

          {/* User Information Section */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 mb-10">
            <h2 className="text-2xl font-bold mb-6">
              Account Information
            </h2>
            <div className="space-y-6">
                <div>
                    <label className="text-sm font-semibold text-[#4c809a] dark:text-slate-400">Full Name</label>
                    <p className="mt-1 text-lg font-medium text-[#0d171b] dark:text-white">John Doe</p>
                </div>
                <div>
                    <label className="text-sm font-semibold text-[#4c809a] dark:text-slate-400">Email Address</label>
                    <p className="mt-1 text-lg font-medium text-[#0d171b] dark:text-white">john.doe@example.com</p>
                </div>
                 <div>
                    <label className="text-sm font-semibold text-[#4c809a] dark:text-slate-400">Account Plan</label>
                    <p className="mt-1 text-lg font-medium text-[#0d171b] dark:text-white">Premium</p>
                </div>
            </div>
             <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button className="inline-flex items-center justify-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 transition-all">
                    Edit Profile
                </button>
             </div>
          </div>

          {/* Recently Viewed Stocks Section */}
          <div>
            <h2 className="text-2xl font-bold mb-6">
              Recently Viewed Stocks
            </h2>
            {recentlyViewedStocks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentlyViewedStocks.map(stock => <StockCard key={stock.symbol} {...stock} />)}
                </div>
            ) : (
                <div className="text-center py-12 px-6 bg-white dark:bg-slate-800/50 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
                    <p className="text-[#4c809a] dark:text-slate-400">You haven't viewed any stocks yet.</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Profile;