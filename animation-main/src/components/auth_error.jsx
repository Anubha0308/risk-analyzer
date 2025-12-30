import { useSearchParams, Link } from "react-router-dom";

function AuthError() {
  const [params] = useSearchParams();
  const type = params.get("type");

  const messages = {
    not_registered: "Account not found. Please sign up first.",
    already_exists: "Account already exists. Please log in.",
    google: "Google authentication failed. Please try again.",
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Authentication Error</h2>
      <p>{messages[type] || "Authentication failed"}</p>

      <div style={{ marginTop: 20 }}>
        <Link to="/login">Go to Login</Link>
        {" | "}
        <Link to="/register">Go to Sign Up</Link>
      </div>
    </div>
  );
}

export default AuthError;
