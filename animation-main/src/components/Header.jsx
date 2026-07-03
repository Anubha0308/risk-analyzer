import React, { useState } from "react";
import { Link } from "react-router-dom";
import NotificationBell from "./notificationBell";
import { useTheme } from "../context/ThemeContext.jsx";

const Header = ({ onProfileClick, onNotificationsClick }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const navLinks = [
    { to: "/market-overview", label: "Market Overview" },
    { to: "/about", label: "About" },
    { to: "/Disclaimer", label: "Model Information" },
  ];
  
  return (
     //header is sticky 
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d171b]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13a4ec]/10 text-[#13a4ec] ring-1 ring-[#13a4ec]/20">
              <span className="material-symbols-outlined text-xl">
                candlestick_chart
              </span>
            </div>
            <span
              className="text-xl font-bold tracking-tight text-[#0d171b] dark:text-white"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              RiskAI
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d171b] dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">
                {dark ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <NotificationBell onClick={onNotificationsClick} />
            <button
              onClick={onProfileClick}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d171b] dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              style={{ fontFamily: "Manrope, sans-serif" }}
              aria-label="Profile"
            >
              <span className="material-symbols-outlined text-lg">person</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0d171b] shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 transition-colors md:hidden"
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
            >
              <span className="material-symbols-outlined text-lg">menu</span>
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute inset-x-0 top-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d171b] shadow-xl z-50">
          <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
            <div className="space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#0d171b] transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-900"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
//error display creating problem here 
