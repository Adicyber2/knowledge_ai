import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../service/api";
import "../index.css";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);

  // Check for valid token in URL
  useEffect(() => {
    if (!token || !email) {
      setError("Invalid or missing reset link. Please request a new one.");
    }
  }, [token, email]);

  const validate = () => {
    const errs = [];
    if (password.length < 6) errs.push("Password must be at least 6 characters.");
    if (password !== confirmPassword) errs.push("Passwords do not match.");
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setValidationErrors([]);

    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    try {
      setLoading(true);

      await api.post("/auth/reset-password", {
        token,
        email,
        password,
        confirmPassword,
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to reset password. The link may have expired."
      );
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = () => {
    if (!password) return "var(--text-muted)";
    if (password.length < 6) return "#ef4444";
    if (password.length < 10) return "#f59e0b";
    return "#22c55e";
  };

  const strengthLabel = () => {
    if (!password) return "";
    if (password.length < 6) return "Too short";
    if (password.length < 10) return "Fair";
    return "Strong";
  };

  return (
    <main className="auth-container">
      <div className="auth-visual">
        <div className="brand">
          <span className="brand-icon">✦</span>
          Knowledge Vault
        </div>

        <div className="visual-content">
          <span className="eyebrow">SECURE RESET</span>
          <h1>
            Set a new
            <br />
            <span>password.</span>
          </h1>
          <p>
            Choose a strong password to keep
            your knowledge vault secure.
          </p>
        </div>

        <div className="floating-node node-one">🔒</div>
        <div className="floating-node node-two">✦</div>
        <div className="floating-node node-three">🛡️</div>
      </div>

      <div className="auth-panel">
        <div className="auth-box">
          <div className="mobile-brand">
            <span>✦</span>
            Knowledge Vault
          </div>

          {success ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
              <h2 style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Password Reset!
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Your password has been updated successfully. Redirecting you to
                login...
              </p>
              <Link
                to="/login"
                style={{
                  color: "var(--accent-primary)",
                  textDecoration: "underline",
                }}
              >
                Go to Login now →
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-heading">
                <h2>New Password</h2>
                <p>
                  {email
                    ? `Resetting password for ${email}`
                    : "Enter your new password below."}
                </p>
              </div>

              {error && (
                <div className="auth-error">{error}</div>
              )}

              {validationErrors.length > 0 && (
                <div className="auth-error">
                  {validationErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <label>New Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!token || !email}
                  autoFocus
                />

                {/* Password strength indicator */}
                {password && (
                  <div style={{
                    fontSize: "0.75rem",
                    color: strengthColor(),
                    marginTop: "-0.5rem",
                    marginBottom: "0.5rem",
                  }}>
                    Password strength: {strengthLabel()}
                  </div>
                )}

                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={!token || !email}
                />

                {confirmPassword && password !== confirmPassword && (
                  <div style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "-0.5rem",
                    marginBottom: "0.5rem",
                  }}>
                    Passwords do not match
                  </div>
                )}

                <button
                  className="auth-button"
                  disabled={loading || !token || !email}
                >
                  {loading ? "Updating..." : "Reset Password"}
                  {!loading && <span>→</span>}
                </button>
              </form>
            </>
          )}

          <div className="auth-divider">
            <span>or</span>
          </div>

          <p className="auth-switch">
            Back to{" "}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default ResetPassword;
