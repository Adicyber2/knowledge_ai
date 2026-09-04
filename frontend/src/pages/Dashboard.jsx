import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getDashboardData, getKnowledgeActivity } from "../service/dashboardService";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllRead,
  keepKnowledgePermanent,
  deleteKnowledgeNow,
  dismissNotification,
} from "../service/notificationService";

import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

const Dashboard = () => {
  /* ================= AUTH ================= */

  const { user, loading: authLoading } = useAuth();

  const navigate = useNavigate();


  /* ================= STATE ================= */

  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState([]);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading] = useState({});
  const notifRef = useRef(null);


  /* ================= LOAD KNOWLEDGE ================= */

 useEffect(() => {

  if (authLoading || !user) {
    return;
  }

  const loadDashboard = async () => {

    try {

      setLoading(true);
      setError("");

      // Dashboard / Knowledge data
      const data = await getDashboardData();

      setKnowledge(
        Array.isArray(data)
          ? data
          : []
      );

      // Activity data
      const activityData =
        await getKnowledgeActivity();

      console.log(
        "🔥 FRONTEND ACTIVITY:",
        activityData
      );

      setActivity(
        Array.isArray(activityData)
          ? activityData
          : []
      );

    } catch (error) {

      console.error(
        "Failed to load dashboard:",
        error.response?.data ||
        error.message
      );

      setError(
        error.response?.data?.message ||
        "Failed to load dashboard data."
      );

    } finally {

      setLoading(false);

    }
  };

  loadDashboard();

}, [authLoading, user]);


  /* ================= NOTIFICATIONS ================= */

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err.message);
    }
  };

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  // Close notification panel on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKeepPermanent = async (notifId) => {
    setNotifLoading((p) => ({ ...p, [notifId]: "keep" }));
    try {
      await keepKnowledgePermanent(notifId);
      await loadNotifications();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to mark as permanent");
    } finally {
      setNotifLoading((p) => ({ ...p, [notifId]: null }));
    }
  };

  const handleDeleteNow = async (notifId) => {
    if (!window.confirm("Delete this knowledge item now? This cannot be undone.")) return;
    setNotifLoading((p) => ({ ...p, [notifId]: "delete" }));
    try {
      await deleteKnowledgeNow(notifId);
      await loadNotifications();
      // Refresh knowledge count
      const data = await getDashboardData();
      setKnowledge(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete");
    } finally {
      setNotifLoading((p) => ({ ...p, [notifId]: null }));
    }
  };

  const handleDismiss = async (notifId) => {
    setNotifLoading((p) => ({ ...p, [notifId]: "dismiss" }));
    try {
      await dismissNotification(notifId);
      await loadNotifications();
    } catch (err) {
      console.error("Dismiss failed:", err.message);
    } finally {
      setNotifLoading((p) => ({ ...p, [notifId]: null }));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      await loadNotifications();
    } catch (err) {
      console.error("Mark all read failed:", err.message);
    }
  };


//   const fetchActivity = async () => {
//   try {
//     const token = localStorage.getItem("token");

//     const res = await axios.get(
//       `${API_URL}/api/knowledge/activity`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     setActivity(res.data);

//   } catch (error) {
//     console.error(
//       "Activity fetch error:",
//       error
//     );
//   }
// };


  /* ================= DYNAMIC COUNTS ================= */

  const totalKnowledge =
    knowledge.length;


  const articleCount =
    knowledge.filter(
      (item) =>
        item.sourceType === "article"
    ).length;


  const youtubeCount =
    knowledge.filter(
      (item) =>
        item.sourceType === "youtube"
    ).length;


  /*
   * Old records may have "note"
   * New records may have "text"
   *
   * So both are counted as Notes.
   */

  const noteCount =
    knowledge.filter(
      (item) =>
        item.sourceType === "note" ||
        item.sourceType === "text"
    ).length;


  const pdfCount =
    knowledge.filter(
      (item) =>
        item.sourceType === "pdf"
    ).length;


    const totalTags = [
  ...new Set(
    knowledge.flatMap(
      (item) => item.tags || []
    )
  ),
].length;


const aiProcessedCount =
  knowledge.filter(
    (item) => item.aiProcessed === true
  ).length;

  /* ================= RECENT KNOWLEDGE ================= */

  const recentKnowledge = [
    ...knowledge
  ]
    .sort(
      (a, b) =>
        new Date(
          b.createdAt || 0
        ) -
        new Date(
          a.createdAt || 0
        )
    )
    .slice(0, 5);


  /* ================= LOADING ================= */

  if (authLoading) {

    return (
      <div className="dashboard-loading">
        Loading your profile...
      </div>
    );

  }


  /* ================= NO USER ================= */

  if (!user) {
    return null;
  }


  /* ================= UI ================= */

  return (

    <div className="vault-layout">

      <Sidebar />


      <main className="vault-main">


        {/* =====================================================
            TOP BAR
        ====================================================== */}

        <header className="topbar">

          <div>

            <span className="topbar-label">
              OVERVIEW
            </span>


            <h1>
              Good evening,{" "}
              {user.name || "User"} 👋
            </h1>


            <p>
              Here's what's happening in your
              knowledge vault.
            </p>

          </div>


          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>

            {/* ===== NOTIFICATION BELL ===== */}
            <div style={{ position: "relative" }} ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications((v) => !v);
                  if (!showNotifications && unreadCount > 0) handleMarkAllRead();
                }}
                title="Notifications"
                style={{
                  background: "var(--glass-bg, rgba(255,255,255,0.05))",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                  borderRadius: "50%",
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  position: "relative",
                  color: "var(--text-primary, #f8fafc)",
                  transition: "background 0.2s",
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "0.65rem",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* ===== NOTIFICATION DROPDOWN ===== */}
              {showNotifications && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  width: "360px",
                  maxHeight: "480px",
                  overflowY: "auto",
                  background: "var(--card-bg, #1e293b)",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                  borderRadius: "12px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                  zIndex: 1000,
                  padding: "0",
                }}>

                  {/* Header */}
                  <div style={{
                    padding: "1rem 1.25rem",
                    borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.08))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <span style={{ fontWeight: "600", color: "var(--text-primary, #f8fafc)", fontSize: "0.9rem" }}>
                      🔔 Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent-primary, #6366f1)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          padding: "2px 6px",
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Empty state */}
                  {notifications.length === 0 && (
                    <div style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-muted, #94a3b8)",
                      fontSize: "0.875rem",
                    }}>
                      ✅ No new notifications
                    </div>
                  )}

                  {/* Notification items */}
                  {notifications.map((notif) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((new Date(notif.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
                    );
                    const isLoading = notifLoading[notif._id];

                    return (
                      <div
                        key={notif._id}
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                          background: notif.read ? "transparent" : "rgba(99,102,241,0.05)",
                          transition: "background 0.2s",
                        }}
                      >
                        <div style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          marginBottom: "0.6rem",
                        }}>
                          <span style={{ fontSize: "1rem" }}>⏰</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: "600",
                              color: "var(--text-primary, #f8fafc)",
                              fontSize: "0.825rem",
                              marginBottom: "0.2rem",
                              lineHeight: "1.3",
                            }}>
                              {notif.isPermanent ? "✅ Kept permanently" : (
                                daysLeft === 0
                                  ? `"${notif.knowledgeTitle}" expires today!`
                                  : `"${notif.knowledgeTitle}" expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                              )}
                            </div>
                            {!notif.isPermanent && (
                              <div style={{
                                fontSize: "0.75rem",
                                color: daysLeft <= 1 ? "#ef4444" : daysLeft <= 3 ? "#f59e0b" : "var(--text-muted, #94a3b8)",
                              }}>
                                Expires: {new Date(notif.expiresAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!notif.isPermanent && (
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button
                              onClick={() => handleKeepPermanent(notif._id)}
                              disabled={!!isLoading}
                              style={{
                                flex: 1,
                                padding: "0.35rem 0.6rem",
                                background: "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.4)",
                                borderRadius: "6px",
                                color: "#818cf8",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                fontWeight: "500",
                                transition: "all 0.2s",
                                opacity: isLoading ? 0.6 : 1,
                              }}
                            >
                              {isLoading === "keep" ? "Saving..." : "♾ Keep Permanently"}
                            </button>

                            <button
                              onClick={() => handleDeleteNow(notif._id)}
                              disabled={!!isLoading}
                              style={{
                                flex: 1,
                                padding: "0.35rem 0.6rem",
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: "6px",
                                color: "#f87171",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                fontWeight: "500",
                                opacity: isLoading ? 0.6 : 1,
                              }}
                            >
                              {isLoading === "delete" ? "Deleting..." : "🗑 Delete Now"}
                            </button>

                            <button
                              onClick={() => handleDismiss(notif._id)}
                              disabled={!!isLoading}
                              title="Dismiss notification"
                              style={{
                                padding: "0.35rem 0.5rem",
                                background: "transparent",
                                border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                                borderRadius: "6px",
                                color: "var(--text-muted, #94a3b8)",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                opacity: isLoading ? 0.6 : 1,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              className="primary-button"
              onClick={() => navigate("/knowledge")}
            >
              + Add Knowledge
            </button>

          </div>

        </header>


        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (

          <div className="dashboard-error">
            {error}
          </div>

        )}


        {/* =====================================================
            STATS CARDS
        ====================================================== */}

        <section className="stats-grid">


          {/* TOTAL KNOWLEDGE */}

          <div className="premium-stat">

            <span>
              ◉
            </span>


            <div>

              <small>
                Total Knowledge
              </small>


              <h2>
                {loading
                  ? "..."
                  : totalKnowledge}
              </h2>

            </div>


            {/* Existing UI preserved */}

           

          </div>


          {/* ARTICLES */}

          <div className="premium-stat">

            <span>
              ✦
            </span>


            <div>

              <h3>
                Articles
              </h3>


              <h2>
                {loading
                  ? "..."
                  : articleCount}
              </h2>

            </div>


           

          </div>


          {/* YOUTUBE */}

          <div className="premium-stat">

            <span>
              ◈
            </span>


            <div>

              <h3>
                YouTube
              </h3>


              <h2>
                {loading
                  ? "..."
                  : youtubeCount}
              </h2>

            </div>


           

          </div>


          {/* NOTES */}

          <div className="premium-stat">

            <span>
              ◈
            </span>


            <div>

              <h3>
                Notes
              </h3>


              <h2>
                {loading
                  ? "..."
                  : noteCount}
              </h2>

            </div>


            

          </div>


          {/* PDF */}

          <div className="premium-stat">

            <span>
              ⌁
            </span>


            <div>

              <h3>
                PDFs
              </h3>


              <h2>
                {loading
                  ? "..."
                  : pdfCount}
              </h2>

            </div>


            

          </div>


          <div className="premium-stat">

  <span>
    🏷️
  </span>

  <div>
    <h3>
      Total Tags
    </h3>

    <h2>
      {loading
        ? "..."
        : totalTags}
    </h2>
  </div>

</div>


<div className="premium-stat">

  <span>
    🤖
  </span>

  <div>
    <h3>
      AI Processed
    </h3>

    <h2>
      {loading
        ? "..."
        : aiProcessedCount}
    </h2>
  </div>

</div>


        </section>


        {/* =====================================================
            DASHBOARD GRID
        ====================================================== */}

        <section className="dashboard-grid">


          {/* ================= ACTIVITY ================= */}

         <div className="activity-card">

  <div className="section-heading">

    <div>
      <h2>Knowledge Activity</h2>

      <p>
        Your activity over the last 7 days.
      </p>
    </div>

    <select>
      <option>Last 7 days</option>
      <option>Last 30 days</option>
    </select>

  </div>


  {/* Activity Chart */}

  <div className="activity-chart">

    {activity.length === 0 ? (

      <div className="chart-empty">
        No activity yet
      </div>

    ) : (

      <div className="bars">

        {activity.map((item) => {

          const max = Math.max(
            ...activity.map(
              (x) => x.count
            ),
            1
          );

          const height =
            (item.count / max) * 100;

          return (

            <div
              className="bar-wrapper"
              key={item.date}
              title={`${item.date}: ${item.count} item(s)`}
            >

              <div
                className="bar"
                style={{
                  height: `${Math.max(
                    height,
                    item.count > 0
                      ? 8
                      : 2
                  )}%`,
                }}
              />

              <span>
                {new Date(
                  item.date + "T00:00:00"
                ).toLocaleDateString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                  }
                )}
              </span>

            </div>

          );

        })}

      </div>

    )}

  </div>

</div>


          {/* ================= AI ================= */}

          <div className="quick-ai">

            <div className="ai-orb">
              ✦
            </div>


            <span>
              AI ASSISTANT
            </span>


            <h2>

              Ask anything
              <br />

              about your vault.

            </h2>


            <button
              onClick={() =>
                navigate("/ai-chat")
              }
            >
              Start chatting →
            </button>

          </div>


        </section>


        {/* =====================================================
            RECENT KNOWLEDGE
        ====================================================== */}

        <section className="recent-section">


          <div className="section-heading">


            <div>

              <h2>
                Recent Knowledge
              </h2>


              <p>
                Your latest saved information.
              </p>

            </div>


            <button
              onClick={() =>
                navigate("/knowledge")
              }
            >
              View All
            </button>


          </div>


          {/* ================= LOADING ================= */}

          {loading && (

            <div className="knowledge-preview">

              <p>
                Loading recent knowledge...
              </p>

            </div>

          )}


          {/* ================= EMPTY ================= */}

          {!loading &&
            recentKnowledge.length === 0 && (

              <div className="knowledge-preview">

                <p>
                  No knowledge saved yet.
                </p>


                <button
                  onClick={() =>
                    navigate("/knowledge")
                  }
                >
                  Add Knowledge
                </button>

              </div>

            )}


          {/* ================= DATA ================= */}

          {!loading &&
            recentKnowledge.length > 0 && (

              <div className="knowledge-preview">


                {recentKnowledge.map(
                  (item) => (

                    <article
                      className="knowledge-preview-card"
                      key={item._id}
                    >


                      {/* SOURCE ICON */}

                      <span>

                        {item.sourceType ===
                        "youtube"
                          ? "▶️"
                          : item.sourceType ===
                            "pdf"
                          ? "📄"
                          : item.sourceType ===
                            "article"
                          ? "📰"
                          : "📝"}

                      </span>


                      <div>


                        {/* TITLE */}

                        <h3>
                          {item.title ||
                            "Untitled Knowledge"}
                        </h3>


                        {/* SOURCE TYPE */}

                        <p>

                          {item.sourceType ===
                          "youtube"
                            ? "YouTube"
                            : item.sourceType ===
                              "pdf"
                            ? "PDF"
                            : item.sourceType ===
                              "article"
                            ? "Article"
                            : "Note"}

                        </p>


                        {/* TAGS */}

                        <div>


                          {item.tags &&
                          item.tags.length > 0 ? (

                            item.tags
                              .slice(0, 2)
                              .map(
                                (
                                  tag,
                                  index
                                ) => (

                                  <small
                                    key={index}
                                  >
                                    {tag}
                                  </small>

                                )
                              )

                          ) : (

                            <small>
                              {item.sourceType ||
                                "Knowledge"}
                            </small>

                          )}


                        </div>


                      </div>


                    </article>

                  )
                )}


              </div>

            )}


        </section>


      </main>

    </div>

  );

};


export default Dashboard;