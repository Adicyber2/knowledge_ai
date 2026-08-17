import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {

  const { user, logout } = useAuth();

  return (
    <aside className="vault-sidebar">

      <div>

        <div className="vault-logo">
          <span>✦</span>

          <div>
            <strong>Knowledge</strong>
            <small>Vault</small>
          </div>
        </div>

        <div className="sidebar-section">

          <span className="sidebar-label">
            WORKSPACE
          </span>

          <NavLink to="/dashboard">
            <span>⌂</span>
            Overview
          </NavLink>

          <NavLink to="/knowledge">
            <span>◉</span>
            Knowledge
          </NavLink>

          <NavLink to="/chat">
            <span>✦</span>
            AI Chat
          </NavLink>

          <NavLink to="/graph">
            <span>◈</span>
            Knowledge Graph
          </NavLink>

        </div>

      </div>

      <div className="sidebar-bottom">

        <div className="user-mini">

          <div className="avatar">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>

          <div>
            <strong>
              {user?.name || "User"}
            </strong>

            <small>
              Personal Vault
            </small>
          </div>

        </div>

        <button
          className="logout-button"
          onClick={logout}
        >
          Logout
        </button>

      </div>

    </aside>
  );
};

export default Sidebar;