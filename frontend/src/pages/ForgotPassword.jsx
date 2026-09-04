import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../service/api";
import "../index.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post("/auth/forgot-password", { email: email.trim() });

      // Always show success (server hides whether email exists)
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container">
      <div className="auth-visual">
        <div className="brand">
          <span className="brand-icon">✦</span>
          Knowledge Vault
        </div>

        <div className="visual-content">
          <span className="eyebrow">PASSWORD RESET</span>
          <h1>
            Forgot your
            <br />
            <span>password?</span>
          </h1>
          <p>
            Enter your email and we'll send you
            a link to reset it securely.
          </p>
        </div>

        <div className="floating-node node-one">🔑</div>
        <div className="floating-node node-two">🔒</div>
        <div className="floating-node node-three">✉️</div>
      </div>

      <div className="auth-panel">
        <div className="auth-box">
          <div className="mobile-brand">
            <span>✦</span>
            Knowledge Vault
          </div>

          {!submitted ? (
            <>
              <div className="auth-heading">
                <h2>Reset Password</h2>
                <p>We'll send a reset link to your email.</p>
              </div>

              {error && (
                <div className="auth-error">{error}</div>
              )}

              <form onSubmit={handleSubmit}>
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />

                <button
                  className="auth-button"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                  {!loading && <span>→</span>}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{
                fontSize: "3rem",
                marginBottom: "1rem",
              }}>
                ✅
              </div>
              <h2 style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Check your email
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                If an account exists for <strong>{email}</strong>, a password
                reset link has been sent. Check your inbox (and spam folder).
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                The link expires in 1 hour.
              </p>
            </div>
          )}

          <div className="auth-divider">
            <span>or</span>
          </div>

          <p className="auth-switch">
            Remember your password?{" "}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default ForgotPassword;
