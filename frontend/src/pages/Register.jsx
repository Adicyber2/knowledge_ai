import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      await register(
        form.name,
        form.email,
        form.password
      );

      navigate("/login");

    } catch (error) {
      setError(
        error.response?.data?.message ||
        "Registration failed"
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
            BUILD YOUR SECOND BRAIN
          </span>

          <h1>
            Save.
            <br />
            Organize.
            <br />
            <span>Discover.</span>
          </h1>

          <p>
            Turn scattered information into an
            intelligent personal knowledge system.
          </p>

        </div>

        <div className="floating-node node-one">
          🧠 Knowledge
        </div>

        <div className="floating-node node-two">
          ✨ AI
        </div>

        <div className="floating-node node-three">
          🕸 Graph
        </div>

      </div>

      <div className="auth-panel">

        <div className="auth-box">

          <div className="mobile-brand">
            <span>✦</span>
            Knowledge Vault
          </div>

          <div className="auth-heading">

            <h2>Create your vault</h2>

            <p>
              Start building your personal knowledge system.
            </p>

          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <label>Name</label>

            <input
              name="name"
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <label>Email</label>

            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <label>Password</label>

            <input
              name="password"
              type="password"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={handleChange}
              minLength={6}
              required
            />

            <button
              className="auth-button"
              disabled={loading}
            >
              {loading
                ? "Creating..."
                : "Create account →"
              }
            </button>

          </form>

          <p className="auth-switch register-switch">

            Already have an account?

            <Link to="/login">
              Sign in
            </Link>

          </p>

        </div>

      </div>

    </main>
  );
};

export default Register;