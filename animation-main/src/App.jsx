// App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Register from "./components/register.jsx";
import Login from "./components/login.jsx";
import Whatall from "./components/whatall.jsx";
import Home from "./components/home.jsx";
import SellAdvice from "./graphs/selladvice.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contents" element={<Whatall />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/selladvice" element={<SellAdvice />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
