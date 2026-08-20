import { useState } from "react";


const KnowledgeCard = ({
  item,
  onEdit,
  onDelete,
}) => {

  const [menuOpen, setMenuOpen] =
    useState(false);


  return (

    <article className="knowledge-card">

      <div className="knowledge-card-top">

        <div className="knowledge-icon">

          {item.sourceType === "youtube"
            ? "▶"
            : item.sourceType === "pdf"
            ? "📄"
            : item.sourceType === "article"
            ? "🌐"
            : "📝"}

        </div>


        <div className="card-menu-wrapper">

          <button
            className="card-menu"
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
          >
            ⋯
          </button>


          {menuOpen && (

            <div className="card-menu-dropdown">

              <button
                onClick={() => {

                  setMenuOpen(false);

                  onEdit(item);

                }}
              >
                ✏️ Edit
              </button>


             <button
  onClick={() => handleDeleteKnowledge(item._id)}
>
  Delete
</button>

            </div>

          )}

        </div>

      </div>


      <div className="knowledge-card-content">

        <span className="source-type">
          {item.sourceType || "NOTE"}
        </span>


        <h3>
          {item.title}
        </h3>


        <p>
          {item.summary ||
            item.content?.slice(0, 120)}

          {item.content?.length > 120
            ? "..."
            : ""}
        </p>

      </div>


      <div className="knowledge-card-footer">

        <div className="tags">

          {item.tags?.slice(0, 3).map(
            (tag) => (

              <span key={tag}>
                #{tag}
              </span>

            )
          )}

        </div>


        <small>

          {item.createdAt
            ? new Date(
                item.createdAt
              ).toLocaleDateString()
            : ""}

        </small>

      </div>

    </article>

  );
};


export default KnowledgeCard;