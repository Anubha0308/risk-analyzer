import { useSearchParams, Link } from "react-router-dom";

const messages = {
  not_registered: {
    title: "Account not found",
    body: "No account exists for this email. Sign up to get started.",
  },
  already_exists: {
    title: "Account already exists",
    body: "An account with this email is already registered. Log in instead.",
  },
  google: {
    title: "Google sign-in failed",
    body: "We couldn't complete Google authentication. Please try again or use email.",
  },
};

function AuthError() {
  const [params] = useSearchParams();
  const type = params.get("type");
  const { title, body } = messages[type] || {
    title: "Authentication error",
    body: "Something went wrong during authentication. Please try again.",
  };

  return (
    <div
      className="min-h-screen bg-[#f6f7f8] flex flex-col items-center justify-center p-4"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-red-500 mb-5 ring-1 ring-red-100 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">
              error
            </span>
          </div>
          <h1 className="text-[#0d171b] tracking-tight text-[24px] font-bold leading-tight mb-2">
            {title}
          </h1>
          <p className="text-[#4c809a] text-sm font-normal leading-normal max-w-[300px] mx-auto">
            {body}
          </p>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-3">
          <Link
            to="/login"
            className="w-full h-12 bg-[#13a4ec] hover:bg-[#0f8ac4] text-white text-sm font-bold rounded-xl shadow-md shadow-[#13a4ec]/20 hover:shadow-lg hover:shadow-[#13a4ec]/30 transition-all duration-200 flex items-center justify-center"
          >
            Go to Login
          </Link>
          <Link
            to="/register"
            className="w-full h-12 border border-[#cfdfe7] hover:bg-slate-50 text-[#0d171b] text-sm font-bold rounded-xl transition-colors flex items-center justify-center"
          >
            Create Account
          </Link>
        </div>

        <div className="bg-slate-50 px-8 py-4 text-center border-t border-slate-100">
          <Link
            to="/"
            className="text-xs text-[#4c809a] hover:text-[#13a4ec] font-semibold transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AuthError;
