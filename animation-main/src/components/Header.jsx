import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d171b]/95 backdrop-blur-md">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13a4ec]/10 text-[#13a4ec] ring-1 ring-[#13a4ec]/20">
            <span className="material-symbols-outlined text-xl">candlestick_chart</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0d171b] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            RiskAI
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/market-overview" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            Market Overview
          </Link>
          <Link to="/about" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            About
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center justify-center rounded-lg bg-[#0d171b] dark:bg-slate-800 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#1a2830] dark:hover:bg-slate-700 transition-all"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Profile
          </button>
        </div>
      </div>
    </div>
  </header>
);

export default Header;

