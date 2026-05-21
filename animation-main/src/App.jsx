// App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/selladvice" element={<SellAdvice />} />
        <Route path="/about" element={<About />} />
        <Route path="/market-overview" element={<MarketOverview />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth-error" element={<AuthError />} />
        <Route path="/notifications" element={<NotificationBell />} />
        <Route path="/portfolios" element={<Portfolios />} />
        <Route path="/Oneportfolio/:id" element={<Oneportfolio />} />
        <Route path="/portfolio-analysis/:id" element={<PortfolioAnalyze />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
