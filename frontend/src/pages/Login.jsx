import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../index.css"
const Login = () => {

  const navigate = useNavigate();

  const { user, loading: authLoading, login } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      setLoading(true);
      setError("");

      await login(email, password);

      navigate("/dashboard");

    } catch (error) {

      setError(
        error.response?.data?.message ||
        "Invalid email or password"
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

          <span className="eyebrow">
            YOUR SECOND BRAIN
          </span>

          <h1>
            Capture.
            <br />
            Connect.
            <br />
            <span>Understand.</span>
          </h1>

          <p>
            Store your knowledge, connect ideas,
            and ask AI questions about everything
            you've learned.
          </p>

        </div>

        <div className="floating-node node-one">
          AI
        </div>

        <div className="floating-node node-two">
          RAG
        </div>

        <div className="floating-node node-three">
          React
        </div>

      </div>


      <div className="auth-panel">

        <div className="auth-box">

          <div className="mobile-brand">
            <span>✦</span>
            Knowledge Vault
          </div>

          <div className="auth-heading">

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to continue to your vault.
            </p>

          </div>


          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}


          <form onSubmit={handleSubmit}>

            <label>Email</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />


            <div className="password-label">

              <label>Password</label>

              <Link
                to="/forgot-password"
                className="forgot"
              >
                Forgot password?
              </Link>

            </div>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />


            <button
              className="auth-button"
              disabled={loading}
            >

              {loading
                ? "Signing in..."
                : "Sign in"
              }

              {!loading && <span>→</span>}

            </button>

          </form>


          <div className="auth-divider">
            <span>or</span>
          </div>


          <p className="auth-switch">

            Don't have an account?

            <Link to="/register">
              Create one
            </Link>

          </p>

        </div>

      </div>

    </main>
  );
};

export default Login;