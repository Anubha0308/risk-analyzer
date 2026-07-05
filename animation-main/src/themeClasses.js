/** Shared RiskAI surface classes — matches home.jsx + ThemeContext `dark` on html */

export const page =
  "min-h-screen bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white antialiased";

export const card =
  "rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700";

export const muted = "text-[#4c809a] dark:text-slate-400";

export const btnPrimary =
  "rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] text-white text-sm font-bold shadow-md shadow-[#13a4ec]/20 transition-all";

export const btnSecondary =
  "rounded-lg bg-[#0d171b] dark:bg-slate-800 hover:bg-[#1a2830] dark:hover:bg-slate-700 text-white text-sm font-bold transition-all";

export const btnGhost =
  "text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] dark:text-slate-400 dark:hover:text-[#13a4ec] transition-colors";

export const input =
  "rounded-xl border border-[#cfdfe7] dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-[#0d171b] dark:text-white placeholder:text-[#4c809a] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#13a4ec]/20 focus:border-[#13a4ec] transition-all";

export const tableHead =
  "bg-slate-50 dark:bg-slate-900/60 text-[#4c809a] dark:text-slate-400 font-semibold";

export const profitCls = (value) =>
  Number(value) >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
