// App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Register from "./components/register.jsx";
import Login from "./components/login.jsx";
import Home from "./components/home.jsx";
import SellAdvice from "./graphs/selladvice.jsx";
import About from "./components/About.jsx";
import MarketOverview from "./components/MarketOverview.jsx";
import Profile from "./components/Profile.jsx";
import AuthError from "./components/auth_error.jsx";
import NotificationBell from "./components/notificationBell.jsx";
import Portfolios from "./components/portfolios.jsx";
import Oneportfolio from "./components/Oneportfolio.jsx";
import PortfolioAnalyze from "./components/portfolioAnalyze.jsx";
import OptimizePortfolio from "./components/optimized.jsx";
import Disclaimer from "./components/Disclaimer.jsx";
import Intraday from "./components/intraday.jsx";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8]">
        <span className="material-symbols-outlined animate-spin text-[#13a4ec] text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/selladvice" element={<SellAdvice />} />
      <Route path="/about" element={<About />} />
      <Route path="/market-overview" element={<MarketOverview />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/auth-error" element={<AuthError />} />
      <Route path="/notifications" element={<NotificationBell />} />
      <Route path="/portfolios" element={<ProtectedRoute><Portfolios /></ProtectedRoute>} />
      <Route path="/Oneportfolio/:id" element={<ProtectedRoute><Oneportfolio /></ProtectedRoute>} />
      <Route path="/portfolio-analysis/:id" element={<ProtectedRoute><PortfolioAnalyze /></ProtectedRoute>} />
      <Route path="/optimize/:id" element={<ProtectedRoute><OptimizePortfolio /></ProtectedRoute>} />
      <Route path="/intraday/:symbol" element={<Intraday />} />
      <Route path="/Disclaimer" element={<Disclaimer />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
