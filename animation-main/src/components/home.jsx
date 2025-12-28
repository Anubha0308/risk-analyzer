
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper function to fetch risk data
const fetchRiskData = async (symbol) => {
  const response = await fetch(`/predict/risk/${symbol}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const Header = () => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-xl">analytics</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">RiskAI</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors dark:text-slate-300 dark:hover:text-white">Market Overview</a>
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors dark:text-slate-300 dark:hover:text-white">Screener</a>
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors dark:text-slate-300 dark:hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center rounded-lg bg-slate-200/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-300/80 transition-all">
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
        const riskData = await fetchRiskData(symbol);
        // Placeholder for price, as no API was specified.
        setData({ risk: riskData.risk_level, price: '---.--' });
      } catch (err) {
        setError('Failed to fetch');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol]);

  const riskColor = data?.risk === 'HIGH' ? 'red' : 'amber';
  
  const handleCardClick = () => {
      navigate('/selladvice', { state: { symbol } });
  }

  return (
    <div onClick={handleCardClick} className="cursor-pointer group relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md hover:ring-primary/50 dark:hover:ring-primary/50 transition-all duration-300">
      {loading ? (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
         <div className="flex flex-col items-start h-full">
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{symbol}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{symbol}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{name}</p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full bg-${riskColor}-50 dark:bg-${riskColor}-900/30 px-2.5 py-1 text-xs font-bold text-${riskColor}-600 dark:text-${riskColor}-400 ring-1 ring-inset ring-${riskColor}-600/20`}>
              {data.risk === 'HIGH' ? 'High Risk' : 'Medium Risk'}
            </span>
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">${data.price}</span>
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
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-white font-display min-h-screen flex flex-col overflow-x-hidden antialiased">
      <Header />
      <main className="flex-grow">
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-sky-200 to-blue-200 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-6 flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-primary dark:border-sky-900 dark:bg-sky-950/30">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                New AI Model v2.0 Live
              </div>
              <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-[64px] lg:leading-[1.1]">
                AI-powered stock risk & <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">sell-timing advisor</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Identify downside risk before it happens. Our algorithms analyze thousands of market signals to help you protect your portfolio and avoid heavy losses.
              </p>
              <div className="mt-10 w-full max-w-lg">
                <div className="relative flex items-center group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Enter stock symbol (e.g. AAPL)"
                    className="block w-full rounded-xl border-0 py-4 pl-11 pr-36 text-slate-900 shadow-xl shadow-slate-200/40 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:shadow-none dark:focus:ring-primary transition-shadow"
                  />
                  <div className="absolute inset-y-0 right-1.5 flex py-1.5">
                    <button
                      onClick={handleAnalyze}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background-subtle dark:bg-slate-900/50 py-16 sm:py-24 border-y border-slate-100 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Famous stocks with their respective risks</h2>
                <p className="mt-2 text-slate-600 dark:text-slate-400">AI-detected volatility warnings for the current week.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {famousStocks.map(stock => <StockRiskCard key={stock.symbol} {...stock} />)}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
