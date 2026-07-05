import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { backend_url } from "../config.js";
import ErrorDisplay from "./ErrorDisplay.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const { refetch } = useAuth();

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Password validation (at least 8 characters)
  const atLeastOneUppercase = /[A-Z]/g; // capital letters from A to Z
  const atLeastOneLowercase = /[a-z]/g; // small letters from a to z
  const atLeastOneNumeric = /[0-9]/g; // numbers from 0 to 9
  const atLeastOneSpecialChar = /[#?!@$%^&*-]/g; // any of the special characters within the square brackets
  const eightCharsOrMore = /.{8,}/g; // eight characters or more

  const getPasswordTracker = (value) => ({
    uppercase: value.match(atLeastOneUppercase),
    lowercase: value.match(atLeastOneLowercase),
    number: value.match(atLeastOneNumeric),
    specialChar: value.match(atLeastOneSpecialChar),
    eightCharsOrGreater: value.match(eightCharsOrMore),
  });

  const validatePassword = (value) => {
    const tracker = getPasswordTracker(value);
    const strength = Object.values(tracker).filter(Boolean).length;
    setPasswordStrength(strength);
    return strength === 5;
  };

  const passwordTracker = getPasswordTracker(password);

  const handleGoogleLogin = () => {
    // OAuth flow requires browser redirect, not fetch
    window.location.href = `${backend_url}/auth/google/signup`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate email
    if (!email) {
      setError("Email is required");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate password
    if (!password) {
      setError("Password is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${backend_url}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important for cookies
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await refetch();
        navigate(nextPath);
      } else {
        // Handle error from backend
        if (response.status === 409) {
          setError("User already exists, try logging in");
        } else {
          setError(data.detail || "Registration failed. Please try again.");
        }
      }
    } catch {
      setError("Network error. Please check if the server is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white flex flex-col items-center justify-center p-4"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}

      {/* Auth Card Container */}
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
        {/* Header Section */}
        <div className="px-8 pt-10 pb-4 text-center">
          {/* Logo Placeholder */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#13a4ec]/10 text-[#13a4ec] mb-5 ring-1 ring-[#13a4ec]/20 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">
              candlestick_chart
            </span>
          </div>
          <h1 className="text-[#0d171b] dark:text-white tracking-tight text-[28px] font-bold leading-tight mb-2">
            Create Account
          </h1>
          <p className="text-[#4c809a] dark:text-slate-400 text-sm font-normal leading-normal max-w-[280px] mx-auto">
            Unlock AI-powered insights and manage your watchlists.
          </p>
        </div>

        {/* Tabs */}
        <div className="px-8 mt-4">
          <div className="flex border-b border-[#cfdfe7] dark:border-slate-700">
            <Link
              to="/login"
              className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#4c809a] dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 pb-[13px] pt-2 flex-1 cursor-pointer transition-colors"
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">
                Login
              </p>
            </Link>
            <Link
              to="/register"
              className="flex flex-col items-center justify-center border-b-[3px] border-b-[#13a4ec] text-[#0d171b] dark:text-white pb-[13px] pt-2 flex-1 cursor-pointer transition-colors"
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">
                Sign Up
              </p>
            </Link>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-6 flex flex-col gap-5">
          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <label className="flex flex-col gap-2">
              <p className="text-[#0d171b] dark:text-white text-sm font-medium leading-normal">
                Email Address
              </p>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0d171b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-[#13a4ec]/20 border border-[#cfdfe7] dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 focus:border-[#13a4ec] h-12 placeholder:text-[#4c809a] dark:placeholder:text-slate-500 px-[15px] text-base font-normal leading-normal transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </label>

            {/* Password Field */}
            <label className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p className="text-[#0d171b] dark:text-white text-sm font-medium leading-normal">
                  Password
                </p>
              </div>
              <div className="flex w-full flex-1 items-stretch rounded-xl relative ">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    validatePassword(value);
                  }}
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0d171b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-[#13a4ec]/20 border border-[#cfdfe7] dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 focus:border-[#13a4ec] h-12 placeholder:text-[#4c809a] dark:placeholder:text-slate-500 px-[15px] pr-12 text-base font-normal leading-normal transition-all"
                  placeholder="••••••••"
                  required
                />
                <div className="absolute right-0 top-0 h-full flex items-center justify-center pr-4">
                  <span
                    className="material-symbols-outlined text-[#4c809a] cursor-pointer hover:text-[#13a4ec] transition-colors text-[20px]"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </div>
              </div>
              {password && (
                <div>
                  <div className="text-red-600 dark:text-red-400 text-xs">
                    {passwordStrength < 5 && "Must contain "}
                    {!passwordTracker.uppercase && "uppercase, "}
                    {!passwordTracker.lowercase && "lowercase, "}
                    {!passwordTracker.specialChar && "special character, "}
                    {!passwordTracker.number && "number, "}
                    {!passwordTracker.eightCharsOrGreater &&
                      "eight characters or more"}
                  </div>
                </div>
              )}
            </label>

            {/* Primary Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#13a4ec] hover:bg-[#0f8ac4] text-white text-base font-bold rounded-xl shadow-md shadow-[#13a4ec]/20 hover:shadow-lg hover:shadow-[#13a4ec]/30 transition-all duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? "Registering..." : "Sign Up"}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center justify-center gap-3">
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Or
            </span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
          </div>

          {/* Social Buttons */}
          <div className="grid">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-2 h-11 border border-[#cfdfe7] dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors bg-white dark:bg-slate-800/50 group"
            >
              <img
                alt="Google"
                className="w-8 h-7 rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqIycVTZ6jJavSjIa2SgcdAisX1fqqsrbPdwTmLFrMl9Iq0KkxYwgmMQYJil78PyF1uE9ejo9Tsucb46jJcNCNG64p2qbjEafSlLdGvUsDZq3m6ZAx1UovYLZt7DEnZa2g1qUGYNnNOVzMeGUyYi-zKWn78yU6MZRAWSnofRGfmcWON-8EZwNDX0aTeST0-nnwiq4xKiWPjO9D6g2fPAdnYsDL4CDfNYrYNbZe3R917xvofM3GG1awc2TfdxvXN9o-I1H9nsRK1F4"
              />
              <span className="text-[#0d171b] dark:text-white font-semibold text-sm">
                Google
              </span>
            </button>
          </div>
        </div>

        {/* Footer / Terms */}
        <div className="bg-slate-50 dark:bg-slate-900/40 p-6 text-center border-t border-slate-100 dark:border-slate-700">
          <p className="text-[#4c809a] dark:text-slate-400 text-xs leading-relaxed">
            By signing up, you agree to our{" "}
            <a
              href="#"
              className="text-[#0d171b] dark:text-white font-bold hover:text-[#13a4ec] transition-colors"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-[#0d171b] dark:text-white font-bold hover:text-[#13a4ec] transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
export default Register;
