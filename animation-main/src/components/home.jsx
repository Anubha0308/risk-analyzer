import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper function to fetch risk data
const fetchRiskData = async (symbol) => {
  const response = await fetch(`http://localhost:8000/predict/risk/${symbol}`, {
    method: 'GET',
    credentials: 'include', // Important for cookies/auth
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Network response was not ok' }));
    throw new Error(errorData.detail || 'Failed to fetch risk data');
  }
  return response.json();
};

const Header = () => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d171b]/95 backdrop-blur-md">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13a4ec]/10 text-[#13a4ec] ring-1 ring-[#13a4ec]/20">
            <span className="material-symbols-outlined text-xl">candlestick_chart</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0d171b] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            RiskAI
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            Market Overview
          </a>
          <a href="/about" className="text-sm font-semibold text-[#4c809a] hover:text-[#13a4ec] transition-colors dark:text-slate-300 dark:hover:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            About
          </a>
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

const StockRiskCard = ({ symbol, name }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const riskData = await fetchRiskData(symbol);
        // Extract risk score and level from the response
        setData({ 
          risk: riskData.risk_level, 
          risk_score: riskData.risk_score,
          recommendation: riskData.recommendation 
        });
      } catch (err) {
        console.error(`Error fetching data for ${symbol}:`, err);
        setError(err.message || 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol]);

  const getRiskColor = (risk) => {
    if (risk === 'HIGH') return 'red';
    if (risk === 'MEDIUM') return 'amber';
    return 'green';
  };

  const getRiskLabel = (risk) => {
    if (risk === 'HIGH') return 'High Risk';
    if (risk === 'MEDIUM') return 'Medium Risk';
    return 'Low Risk';
  };

  const riskColor = data ? getRiskColor(data.risk) : 'slate';
  
  const handleCardClick = () => {
    if (!loading && !error) {
      navigate('/selladvice', { state: { symbol } });
    }
  };

  return (
    <div 
      onClick={handleCardClick} 
      className={`cursor-pointer group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-800/50 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-lg hover:ring-[#13a4ec]/50 dark:hover:ring-[#13a4ec]/50 transition-all duration-300 ${loading || error ? 'cursor-default' : ''}`}
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#13a4ec]"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-start h-32 justify-center">
          <h3 className="text-lg font-bold text-[#0d171b] dark:text-white leading-tight mb-1">{symbol}</h3>
          <p className="text-xs text-[#4c809a] dark:text-slate-400">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-[#0d171b] dark:text-white leading-tight">{symbol}</h3>
              <p className="text-xs text-[#4c809a] dark:text-slate-400 mt-0.5">{name}</p>
            </div>
          </div>
          <div className="mb-4">
            <span 
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${
                riskColor === 'red' 
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-600/20'
                  : riskColor === 'amber'
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-amber-600/20'
                  : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 ring-green-600/20'
              }`}
            >
              {getRiskLabel(data.risk)}
            </span>
          </div>
          <div className="mt-auto">
            <div className="text-sm text-[#4c809a] dark:text-slate-400 mb-1">Risk Score</div>
            <div className="text-2xl font-bold text-[#0d171b] dark:text-white">
              {(data.risk_score * 100).toFixed(1)}%
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function Home() {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState('');

  const handleAnalyze = () => {
    if (symbol) {
      navigate('/selladvice', { state: { symbol } });
    }
  };
  
  const famousStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.'},
  ];

  return (
    <div 
      className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col overflow-x-hidden antialiased"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#13a4ec]/20 to-blue-600/20 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-6 flex items-center gap-2 rounded-full border border-[#13a4ec]/20 bg-[#13a4ec]/10 px-4 py-1.5 text-xs font-bold text-[#13a4ec]">
                <span className="flex h-2 w-2 rounded-full bg-[#13a4ec] animate-pulse"></span>
                New AI Model v2.0 Live
              </div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-[#0d171b] dark:text-white sm:text-5xl md:text-6xl lg:text-7xl lg:leading-tight">
                AI-powered stock risk & <span className="text-[#13a4ec]">sell-timing advisor</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#4c809a] dark:text-slate-300">
                Identify downside risk before it happens. Our algorithms analyze thousands of market signals to help you protect your portfolio and avoid heavy losses.
              </p>
              <div className="mt-10 w-full max-w-lg">
                <div className="relative flex items-center group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#4c809a] group-focus-within:text-[#13a4ec] transition-colors">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Enter stock symbol (e.g. AAPL)"
                    className="block w-full rounded-xl border-0 py-4 pl-11 pr-32 text-[#0d171b] shadow-lg shadow-slate-200/50 ring-1 ring-inset ring-[#cfdfe7] placeholder:text-[#4c809a] focus:ring-2 focus:ring-inset focus:ring-[#13a4ec] bg-white dark:bg-slate-800/50 dark:text-white dark:ring-slate-600 sm:text-sm sm:leading-6 transition-all"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  />
                  <div className="absolute inset-y-0 right-1.5 flex py-1.5">
                    <button
                      onClick={handleAnalyze}
                      disabled={!symbol}
                      className="inline-flex items-center rounded-lg bg-[#13a4ec] hover:bg-[#0f8ac4] disabled:bg-slate-300 disabled:cursor-not-allowed px-6 py-2 text-sm font-bold text-white shadow-md shadow-[#13a4ec]/20 hover:shadow-lg transition-all"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Famous Stocks Section */}
        <section className="bg-slate-50 dark:bg-slate-900/80 py-12 sm:py-16 border-y border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-[#0d171b] dark:text-white sm:text-3xl mb-2">
                Famous stocks with their respective risks
              </h2>
              <p className="text-[#4c809a] dark:text-slate-400 text-sm">
                AI-detected volatility warnings for the current week.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {famousStocks.map(stock => <StockRiskCard key={stock.symbol} {...stock} />)}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
