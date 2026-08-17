import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import KnowledgeCard from "../components/KnowledgeCard";

import { getKnowledge,deleteKnowledge } from "../service/knowledgeService";

import AddKnowledgeModal from "../components/AddKnowledgeModal";
import EditKnowledgeModal from "../components/EditKnowledgeModal";

  import "./knowledge.css"



const Knowledge = () => {

  // ==============================
  // Knowledge Data
  // ==============================

  const [knowledge, setKnowledge] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  
  // ==============================
  // Day 21 Search & Filter States
  // ==============================

  const [search, setSearch] = useState("");

  const [sourceFilter, setSourceFilter] =
    useState("all");

  const [selectedTag, setSelectedTag] =
    useState("all");


  // ==============================
  // Modal State
  // ==============================

  const [showModal, setShowModal] =
    useState(false);


    const [editingItem, setEditingItem] =
  useState(null);
  

  const handleAddKnowledge = async () => {
  try {
    const data = await getKnowledge();
    setKnowledge(data);
    setShowModal(false);
  } catch (error) {
    console.error("Failed to refresh knowledge:", error);
  }
};


  // ==============================
  // Load Knowledge
  // ==============================

useEffect(() => {
  const loadKnowledge = async () => {
    try {
      setLoading(true);

      const data = await getKnowledge();

      setKnowledge(data || []);
    } catch (error) {
      console.error("Failed to load knowledge:", error);
    } finally {
      setLoading(false);
    }
  };

  loadKnowledge();
}, []);

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
  // Search + Filter Logic
  // ==============================
const filteredKnowledge = useMemo(() => {
  return (knowledge || []).filter((item) => {
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
  knowledge,
  search,
  sourceFilter,
  selectedTag,
]);

  // ==============================
  // Clear Filters
  // ==============================

  const clearFilters = () => {

    setSearch("");

    setSourceFilter("all");

    setSelectedTag("all");

  };

  const handleDelete = async (item) => {

  const confirmed =
    window.confirm(
      `Delete "${item.title}"?`
    );


  if (!confirmed) return;


  try {

    await deleteKnowledge(item._id);


    setKnowledge((prev) =>
      prev.filter(
        (knowledge) =>
          knowledge._id !== item._id
      )
    );


  } catch (error) {

    console.error(error);

    alert(
      "Failed to delete knowledge"
    );

  }

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


          <button
  className="primary-button"
  onClick={() => setShowModal(true)}
>
  + Add Knowledge
</button>

        </header>


        {/* ======================
            SEARCH
        ======================= */}

        <section className="knowledge-toolbar">

          <div className="search-box">

            <span className="search-icon">
              ⌕
            </span>


            <input
              type="text"
              placeholder="Search your knowledge..."
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
  onClick={() => setShowModal(true)}
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
              Try a different search or
              remove a filter.
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

            {filteredKnowledge.map(
              (item) => (
<KnowledgeCard
  key={item._id}
  item={item}

  onEdit={(item) =>
    setEditingItem(item)
  }

  onDelete={handleDelete}
/>
              )
            )}

          </section>

        )}


        {/* ======================
            Add Knowledge Modal
        ======================= */}

        {showModal && (

          <AddKnowledgeModal
            onClose={() =>
               onClose={handleAddKnowledge}
            }

            onSaved={(newKnowledge) => {

              setKnowledge((prev) => [
                newKnowledge,
                ...prev,
              ]);

            }}
          />

        )}


        {editingItem && (

  <EditKnowledgeModal

    item={editingItem}

    onClose={() =>
      setEditingItem(null)
    }

    onUpdated={(updatedItem) => {

      setKnowledge((prev) =>
        prev.map((item) =>
          item._id === updatedItem._id
            ? updatedItem
            : item
        )
      );

    }}

  />

)}

      </main>

    </div>

  );
};

export default Knowledge;