import { useEffect, useMemo, useState, useCallback } from "react";

import Sidebar from "../components/Sidebar";

import { getKnowledge, deleteKnowledge, analyzeKnowledge, syncOfflineQueue, semanticSearch as semanticSearchApi } from "../service/knowledgeService";

import AddKnowledgeModal from "../components/AddKnowledgeModal";
import EditKnowledgeModal from "../components/EditKnowledgeModal";
import KnowledgeDetailsModal from "../components/KnowledgeDetailsModal";

import "./knowledge.css";


const Knowledge = () => {

  // ==============================
  // Knowledge Data
  // ==============================

  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  // ==============================
  // Search & Filter States
  // ==============================

  const [search, setSearch] = useState("");
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticResults, setSemanticResults] = useState(null);

  const [sourceFilter, setSourceFilter] = useState("all");

  const [selectedTag, setSelectedTag] = useState("all");

  const [deletingId, setDeletingId] = useState(null);

  // ==============================
  // Offline State
  // ==============================
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ==============================
  // Modal State — SEPARATED
  // ==============================

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);


  // ==============================
  // Online / Offline listeners
  // ==============================
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Flush any offline mutations first, then refresh
      try {
        await syncOfflineQueue();
      } catch (err) {
        console.error("Sync queue failed:", err);
      }
      loadKnowledge();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);


  // ==============================
  // Load Knowledge
  // ==============================

  const loadKnowledge = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getKnowledge();
      setKnowledge(data || []);
    } catch (err) {
      console.error("Failed to load knowledge:", err);
      setError("Failed to load knowledge. Showing cached data if available.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);


  // ==============================
  // Refresh after add/edit
  // ==============================

  const handleAddKnowledge = async () => {
    setShowAddModal(false);
    await loadKnowledge();
  };


  // ==============================
  // Edit handler
  // ==============================

  const handleEditKnowledge = (item) => {
    setEditingItem(item);
    setShowEditModal(true);
  };


  // ==============================
  // Get All Unique Tags
  // ==============================

  const allTags = useMemo(() => {
    return [
      ...new Set(
        (knowledge || []).flatMap(
          (item) => item.tags || []
        )
      ),
    ];
  }, [knowledge]);


  // ==============================
  // AI Re-analyze
  // ==============================

  const handleAnalyzeKnowledge = async (id) => {
    try {
      setAnalyzingId(id);

      await analyzeKnowledge(id);

      await loadKnowledge();

    } catch (err) {
      console.error(
        "AI analysis failed:",
        err.response?.data || err.message
      );

      alert(
        err.response?.data?.message ||
        "AI analysis failed"
      );
    } finally {
      setAnalyzingId(null);
    }
  };


  // ==============================
  // Delete handler
  // ==============================

  const handleDeleteKnowledge = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this knowledge?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      await deleteKnowledge(id);

      setKnowledge((prev) =>
        prev.filter((item) => item._id !== id)
      );

    } catch (err) {
      console.error(
        "Delete failed:",
        err.response?.data || err.message
      );

      alert(
        err.response?.data?.message ||
        "Failed to delete knowledge"
      );
    } finally {
      setDeletingId(null);
    }
  };


  // ==============================
  // Search + Filter Logic
  // ==============================

  const displayKnowledge = semanticMode && semanticResults !== null
    ? semanticResults
    : knowledge;

  const filteredKnowledge = useMemo(() => {
    return (displayKnowledge || []).filter((item) => {
      if (semanticMode && semanticResults !== null) {
        // semantic results already filtered by search query
        const matchesSource =
          sourceFilter === "all" ||
          item.sourceType === sourceFilter;
        const matchesTag =
          selectedTag === "all" ||
          item.tags?.includes(selectedTag);
        return matchesSource && matchesTag;
      }

      const searchText = search.trim().toLowerCase();

      const matchesTitle =
        item.title?.toLowerCase().includes(searchText);

      const matchesContent =
        item.content?.toLowerCase().includes(searchText);

      const matchesSummary =
        item.summary?.toLowerCase().includes(searchText);

      const matchesTags =
        item.tags?.some((tag) =>
          tag.toLowerCase().includes(searchText)
        );

      const matchesSearch =
        searchText === "" ||
        matchesTitle ||
        matchesContent ||
        matchesSummary ||
        matchesTags;

      const matchesSource =
        sourceFilter === "all" ||
        item.sourceType === sourceFilter;

      const matchesTag =
        selectedTag === "all" ||
        item.tags?.includes(selectedTag);

      return (
        matchesSearch &&
        matchesSource &&
        matchesTag
      );
    });
  }, [
    displayKnowledge,
    search,
    sourceFilter,
    selectedTag,
    semanticMode,
    semanticResults,
  ]);


  // ==============================
  // Semantic Search (debounced)
  // ==============================

  useEffect(() => {
    if (!semanticMode || !search.trim()) {
      setSemanticResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSemanticLoading(true);
        const results = await semanticSearchApi(search.trim());
        setSemanticResults(results || []);
      } catch (err) {
        console.error("Semantic search failed:", err);
        setSemanticResults([]);
      } finally {
        setSemanticLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [search, semanticMode]);


  // ==============================
  // Clear Filters
  // ==============================

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("all");
    setSelectedTag("all");
    setSemanticResults(null);
  };


  // ==============================
  // Render
  // ==============================

  return (

    <div className="vault-layout">

      {/* Sidebar */}

      <Sidebar />


      {/* Main */}

      <main className="vault-main">

        {/* ======================
            Header
        ======================= */}

        <header className="knowledge-header">

          <div>

            <span className="topbar-label">
              YOUR LIBRARY
            </span>

            <h1>
              Knowledge
            </h1>

            <p>
              Everything you've saved
              in one place.
            </p>

          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!isOnline && (
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                border: "1px solid #854d0e",
                borderRadius: "8px",
                background: "rgba(133,77,14,0.1)",
                color: "#fbbf24",
                fontSize: "12px",
                fontWeight: 500,
              }}>
                <span style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#fbbf24",
                  display: "inline-block",
                }} />
                Offline
              </span>
            )}

            <button
              className="primary-button"
              onClick={() => setShowAddModal(true)}
            >
              + Add Knowledge
            </button>
          </div>

        </header>


        {/* ======================
            SEARCH
        ======================= */}

        <section className="knowledge-toolbar">

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="search-box" style={{ flex: 1 }}>

              <span className="search-icon">
                {semanticLoading ? "⟳" : "⌕"}
              </span>


              <input
                type="text"
                placeholder={
                  semanticMode
                    ? "Ask a question (semantic search)..."
                    : "Search your knowledge..."
                }
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />


              {search && (

                <button
                  className="clear-search"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  ×
                </button>

              )}


              <kbd>
                ⌘ K
              </kbd>

            </div>

            {/* Semantic search toggle */}
            <button
              onClick={() => {
                setSemanticMode((prev) => !prev);
                setSemanticResults(null);
              }}
              title={semanticMode ? "Switch to keyword search" : "Switch to semantic/AI search"}
              style={{
                padding: "10px 14px",
                border: `1px solid ${semanticMode ? "#6d5bb3" : "#252936"}`,
                borderRadius: "12px",
                background: semanticMode ? "rgba(139,92,246,0.1)" : "#11131a",
                color: semanticMode ? "#c4b5fd" : "#64748b",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
                transition: "0.2s",
              }}
            >
              {semanticMode ? "✦ AI Search" : "⌕ AI Search"}
            </button>
          </div>


          {/* ======================
              SOURCE FILTER
          ======================= */}

          <div className="source-filters">

            {[
              "all",
              "article",
              "pdf",
              "youtube",
              "note",
            ].map((type) => (

              <button
                key={type}
                className={
                  sourceFilter === type
                    ? "filter-active"
                    : ""
                }
                onClick={() =>
                  setSourceFilter(type)
                }
              >

                {type === "all"
                  ? "All"
                  : type}

              </button>

            ))}

          </div>


          {/* ======================
              TAG FILTER
          ======================= */}

          {allTags.length > 0 && (

            <div className="tag-filter">

              <span>
                Tags
              </span>


              <button
                className={
                  selectedTag === "all"
                    ? "tag-active"
                    : ""
                }
                onClick={() =>
                  setSelectedTag("all")
                }
              >
                All
              </button>


              {allTags.map((tag) => (

                <button
                  key={tag}
                  className={
                    selectedTag === tag
                      ? "tag-active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedTag(tag)
                  }
                >
                  #{tag}
                </button>

              ))}

            </div>

          )}

        </section>


        {/* ======================
            Result Information
        ======================= */}

        {!loading &&
          knowledge.length > 0 && (

          <div className="result-info">

            <span>
              {semanticMode && semanticResults !== null && (
                <span style={{ color: "#a78bfa", marginRight: "8px" }}>✦ AI</span>
              )}
              {filteredKnowledge.length}
              {" "}
              {filteredKnowledge.length === 1
                ? "result"
                : "results"}
            </span>


            {(search ||
              sourceFilter !== "all" ||
              selectedTag !== "all") && (

              <button
                onClick={clearFilters}
              >
                Clear filters
              </button>

            )}

          </div>

        )}


        {/* ======================
            Loading
        ======================= */}

        {loading && (

          <div className="knowledge-grid">

            {[1, 2, 3, 4, 5, 6].map(
              (item) => (

                <div
                  className="knowledge-skeleton"
                  key={item}
                />

              )
            )}

          </div>

        )}


        {/* ======================
            Error
        ======================= */}

        {error && (

          <div className="auth-error">
            {error}
          </div>

        )}


        {/* ======================
            Empty Database
        ======================= */}

        {!loading &&
          !error &&
          knowledge.length === 0 && (

          <div className="empty-state">

            <div className="empty-icon">
              ✦
            </div>

            <h2>
              Your vault is empty
            </h2>

            <p>
              Start saving knowledge and
              build your second brain.
            </p>

            <button
              className="primary-button"
              onClick={() => setShowAddModal(true)}
            >
              Add your first knowledge
            </button>

          </div>

        )}


        {/* ======================
            No Search Result
        ======================= */}

        {!loading &&
          !error &&
          knowledge.length > 0 &&
          filteredKnowledge.length === 0 && (

          <div className="empty-state">

            <div className="empty-icon">
              🔍
            </div>

            <h2>
              No knowledge found
            </h2>

            <p>
              {semanticMode
                ? "No semantically relevant knowledge found. Try a different query."
                : "Try a different search or remove a filter."}
            </p>

            <button
              className="primary-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>

          </div>

        )}


        {/* ======================
            Knowledge Cards
        ======================= */}

        {!loading &&
          !error &&
          filteredKnowledge.length > 0 && (

          <section className="knowledge-grid">

        {filteredKnowledge.map((item) => (
  <div
    className="knowledge-card"
    key={item._id}
    style={{ cursor: "pointer" }}
    onClick={() => setSelectedDetailItem(item)}
  >

    <div className="knowledge-card-header">
      <div>
        <h3>{item.title}</h3>

        <span className="knowledge-source">
          {item.sourceType || "note"}
        </span>
      </div>

      <div className="knowledge-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleEditKnowledge(item);
          }}
          disabled={deletingId === item._id}
        >
          Edit
        </button>

        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteKnowledge(item._id);
          }}
          disabled={deletingId === item._id}
        >
          {deletingId === item._id ? "..." : "Delete"}
        </button>
      </div>
    </div>

    <p className="knowledge-content">
      {item.summary
        ? item.summary.length > 180
          ? `${item.summary.substring(0, 180)}...`
          : item.summary
        : item.content?.length > 180
          ? `${item.content.substring(0, 180)}...`
          : item.content}
    </p>

    {item.tags?.length > 0 && (
      <div className="knowledge-tags">
        {item.tags.map((tag, index) => (
          <span key={index} className="knowledge-tag">
            #{tag}
          </span>
        ))}
      </div>
    )}

    <div className="knowledge-card-footer">
      <span>
        {item.createdAt
          ? new Date(item.createdAt).toLocaleDateString()
          : ""}
      </span>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {item.aiProcessed && (
          <span style={{ color: "#a78bfa", fontSize: "10px", fontWeight: 600 }}>
            ✦ AI
          </span>
        )}

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            View Source
          </a>
        )}
      </div>
    </div>

  </div>
))}

          </section>

        )}


        {/* ======================
            Add Knowledge Modal
        ======================= */}

        {showAddModal && (

          <AddKnowledgeModal
            onClose={() => setShowAddModal(false)}
            onSaved={handleAddKnowledge}
          />

        )}


        {/* ======================
            Edit Knowledge Modal
        ======================= */}

        {showEditModal && editingItem && (
          <EditKnowledgeModal
            knowledge={editingItem}
            onClose={() => {
              setShowEditModal(false);
              setEditingItem(null);
            }}
            onSaved={async () => {
              setShowEditModal(false);
              setEditingItem(null);
              await loadKnowledge();
            }}
          />
        )}


        {/* ======================
            Knowledge Details Modal
        ======================= */}

        {selectedDetailItem && (
          <KnowledgeDetailsModal
            item={selectedDetailItem}
            onClose={() => setSelectedDetailItem(null)}
          />
        )}

      </main>

    </div>

  );
};

export default Knowledge;