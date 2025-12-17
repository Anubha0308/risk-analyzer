import React from "react";
import TextPressure from "./TextPressure.jsx";

function Login() {
  return (
    <div className="register-container w-full min-h-screen bg-neutral-primary overflow-x-hidden flex flex-col items-center justify-center">
      <div
        style={{
          position: "relative",
          height: "35vh", 
          width: "50%",
          display: "flex",
          alignItems: "center", // vertical center within 35%
          justifyContent: "center", // horizontal center
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
          textColor="#ffffff"
          strokeColor="#ff0000"
          minFontSize={120} 
        />
      </div>

      <div className="register-form w-full lg:w-3/4 h-auto mt-15 flex col items-center justify-center">
        <form className="max-w-5xl w-full sm:w-3/4 md:w-1/2 mx-auto px-6 py-8 bg-transparent">
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block mb-2.5 text-sm font-medium text-heading"
            >
              Your email
            </label>
            <input
              type="email"
              id="email"
              className="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body"
              placeholder="name@flowbite.com"
              required
            />
          </div>
          <div className="mb-5">
            <label
              htmlFor="password"
              className="block mb-2.5 text-sm font-medium text-heading"
            >
              Your password
            </label>
            <input
              type="password"
              id="password"
              className="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body"
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
              required
            />
            <p className="ms-2 text-sm font-medium text-heading select-none">
              I agree with the{" "}
              <a href="#" className="text-fg-brand hover:underline">
                terms and conditions
              </a>
              .
            </p>
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              className="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none"
            >
              Submit
            </button>
            <button className="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none">
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default Login;
