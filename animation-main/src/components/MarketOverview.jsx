import React, { useState, useEffect } from 'react';
import Header from './Header.jsx';
import ErrorDisplay from './ErrorDisplay.jsx';

function MarketOverview() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('http://localhost:8000/market/news', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        const data = await response.json();
        setNews(data.news || []);
      } catch (err) {
        console.error('Error fetching news:', err);
        setError(err.message || 'Failed to load market news');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
  
    const date = new Date(timestamp); // ISO string → Date object
  
    if (isNaN(date.getTime())) return '';
  
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <Header />
      {error && <ErrorDisplay message={error} onClose={() => setError(null)} />}

      <main className="flex-grow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#0d171b] dark:text-white mb-2">
              Market Overview
            </h1>
            <p className="text-[#4c809a] dark:text-slate-400">
              Latest stock market news and insights
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13a4ec]"></div>
            </div>
          )}

          {/* News Grid */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {news.length > 0 ? (
                news.map((item, index) => (
                  <a
                    key={index}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white dark:bg-slate-800/50 rounded-xl p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-lg hover:ring-[#13a4ec]/50 dark:hover:ring-[#13a4ec]/50 transition-all duration-300 flex flex-col"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[#0d171b] dark:text-white mb-3 line-clamp-3">
                        {item.title}
                      </h3>
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-xs text-[#4c809a] dark:text-slate-400">
                        <span className="font-semibold">{item.publisher}</span>
                        <span>{formatDate(item.published)}</span>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-[#4c809a] dark:text-slate-400">No news available at the moment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MarketOverview;

