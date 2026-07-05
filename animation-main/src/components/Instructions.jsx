import React from "react";

const iconStyles = {
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const Instructions = () => (
  <div className="max-w-7xl mx-auto text-center p-6 rounded-2xl bg-white dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700 shadow-xl">
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
          className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-left"
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconStyles[item.color]}`}
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
export default Instructions;
