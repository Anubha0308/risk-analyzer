import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TextPressure from "./TextPressure.jsx";
import ErrorDisplay from "./ErrorDisplay.jsx";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation (at least 6 characters)
  const validatePassword = (password) => {
    return password.length >= 6;
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
    if (!validatePassword(password)) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:8000/login", {
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
        // Login successful, redirect to selladvice
        navigate("/selladvice");
      } else {
        // Handle error from backend
        if (response.status === 404) {
          setError("User does not exist, try register");
        } else if (response.status === 401) {
          setError("Invalid password");
        } else {
          setError(data.detail || "Login failed. Please try again.");
        }
      }
    } catch (err) {
      setError("Network error. Please check if the server is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="register-container w-full min-h-screen bg-neutral-primary overflow-x-hidden flex flex-col items-center justify-center"
      style={{
        background: "#f6f2f3ff",
      }}
    >
      {error && <ErrorDisplay message={error} onClose={() => setError("")} />}
      
      <div
        style={{
          position: "relative",
          height: "35vh", 
          width: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "20px",
        }}
      >
        <TextPressure
          text="Login!"
          flex={true}
          alpha={false}
          stroke={false}
          width={true}
          weight={true}
          italic={true}
          textColor="#3d4453ff"
          strokeColor="#ff0000"
          minFontSize={120} 
        />
      </div>

      <div className="register-form w-full lg:w-3/4 h-auto mt-15 flex col items-center justify-center">
        <form 
          className="max-w-5xl w-full sm:w-3/4 md:w-1/2 mx-auto px-6 py-8 bg-transparent"
          onSubmit={handleSubmit}
        >
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block mb-2.5 text-sm font-medium"
              style={{ color: "#3d4453ff" }}
            >
              Your email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-neutral-secondary-medium border border-default-medium text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs"
              style={{
                backgroundColor: "#f7f9fbff",
                borderColor: "#a8a4abff",
                color: "#3d4453ff",
              }}
              placeholder="name@flowbite.com"
              required
            />
          </div>
          <div className="mb-5">
            <label
              htmlFor="password"
              className="block mb-2.5 text-sm font-medium"
              style={{ color: "#3d4453ff" }}
            >
              Your password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-neutral-secondary-medium border border-default-medium text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs"
              style={{
                backgroundColor: "#f7f9fbff",
                borderColor: "#a8a4abff",
                color: "#3d4453ff",
              }}
              placeholder="••••••••"
              required
            />
          </div>
          <label htmlFor="remember" className="flex items-center mb-5">
            <input
              id="remember"
              type="checkbox"
              value=""
              className="w-4 h-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft"
              style={{
                borderColor: "#a8a4abff",
                backgroundColor: "#f7f9fbff",
              }}
              required
            />
            <p
              className="ms-2 text-sm font-medium select-none"
              style={{ color: "#3d4453ff" }}
            >
              I agree with the{" "}
              <a
                href="#"
                className="hover:underline"
                style={{ color: "#13a4ecff" }}
              >
                terms and conditions
              </a>
              .
            </p>
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#13a4ecff",
                color: "#f3f9ffff",
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none"
              style={{
                backgroundColor: "#3d4453ff",
                color: "#f3f9ffff",
              }}
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default Login;
