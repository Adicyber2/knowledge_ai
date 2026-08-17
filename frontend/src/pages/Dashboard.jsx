import Sidebar from "../components/Sidebar";
import "./Dashboard.css"
const Dashboard = () => {

  return (
    <div className="vault-layout">

      <Sidebar />

      <main className="vault-main">

        <header className="topbar">

          <div>
            <span className="topbar-label">
              OVERVIEW
            </span>

            <h1>
              Good evening 👋
            </h1>

            <p>
              Here's what's happening in your knowledge vault.
            </p>
          </div>

          <button className="primary-button">
            + Add Knowledge
          </button>

        </header>


        <section className="stats-grid">

          <div className="premium-stat">
            <span>◉</span>

            <div>
              <small>Total Knowledge</small>
              <strong>128</strong>
            </div>

            <em>+12%</em>
          </div>


          <div className="premium-stat">
            <span>✦</span>

            <div>
              <small>AI Processed</small>
              <strong>96</strong>
            </div>

            <em>+18%</em>
          </div>


          <div className="premium-stat">
            <span>◈</span>

            <div>
              <small>Topics</small>
              <strong>24</strong>
            </div>

            <em>+8%</em>
          </div>


          <div className="premium-stat">
            <span>⌁</span>

            <div>
              <small>Connections</small>
              <strong>342</strong>
            </div>

            <em>+24%</em>
          </div>

        </section>


        <section className="dashboard-grid">

          <div className="activity-card">

            <div className="section-heading">

              <div>
                <h2>Knowledge Activity</h2>
                <p>Your activity over the last 30 days.</p>
              </div>

              <select>
                <option>Last 30 days</option>
                <option>Last 7 days</option>
              </select>

            </div>

            <div className="fake-chart">

              <div className="chart-line">
                ╱╲___╱╲__╱╲___╱╲__
              </div>

              <div className="chart-labels">
                <span>Jul 15</span>
                <span>Jul 22</span>
                <span>Jul 29</span>
                <span>Aug 05</span>
                <span>Aug 14</span>
              </div>

            </div>

          </div>


          <div className="quick-ai">

            <div className="ai-orb">
              ✦
            </div>

            <span>AI ASSISTANT</span>

            <h2>
              Ask anything
              <br />
              about your vault.
            </h2>

            <button>
              Start chatting →
            </button>

          </div>

        </section>


        <section className="recent-section">

          <div className="section-heading">

            <div>
              <h2>Recent Knowledge</h2>
              <p>
                Your latest saved information.
              </p>
            </div>

            <button className="text-button">
              View all →
            </button>

          </div>


          <div className="knowledge-preview">

            <article className="knowledge-preview-card">
              <span>🤖</span>

              <div>
                <h3>Large Language Models</h3>

                <p>
                  AI • 8 min read
                </p>

                <div>
                  <small>LLM</small>
                  <small>AI</small>
                </div>
              </div>
            </article>


            <article className="knowledge-preview-card">
              <span>🧠</span>

              <div>
                <h3>Understanding RAG</h3>

                <p>
                  Research • 12 min read
                </p>

                <div>
                  <small>RAG</small>
                  <small>LLM</small>
                </div>
              </div>
            </article>


            <article className="knowledge-preview-card">
              <span>⚛️</span>

              <div>
                <h3>React Architecture</h3>

                <p>
                  Development • 6 min read
                </p>

                <div>
                  <small>React</small>
                  <small>Frontend</small>
                </div>
              </div>
            </article>

          </div>

        </section>

      </main>

    </div>
  );
};

export default Dashboard;