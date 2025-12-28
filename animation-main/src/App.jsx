// App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Register from "./components/register.jsx";
import Login from "./components/login.jsx";
import Whatall from "./components/whatall.jsx";
import Home from "./components/home.jsx";
import SellAdvice from "./graphs/selladvice.jsx";
import About from "./components/About.jsx";
import MarketOverview from "./components/MarketOverview.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contents" element={<Whatall />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/selladvice" element={<SellAdvice />} />
        <Route path="/about" element={<About />} />
        <Route path="/market-overview" element={<MarketOverview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
