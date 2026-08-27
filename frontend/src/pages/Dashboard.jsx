import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getDashboardData,getKnowledgeActivity } from "../service/dashboardService";
import { useNavigate } from "react-router-dom";

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


          <button
            className="primary-button"
            onClick={() =>
              navigate("/knowledge")
            }
          >
            + Add Knowledge
          </button>

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