import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#090d16",
          color: "#94a3b8",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "0.95rem",
          letterSpacing: "0.02em",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#6366f1", fontSize: "1.2rem" }}>✦</span>
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;