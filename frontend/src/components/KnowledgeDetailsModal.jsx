import { useEffect } from "react";
import "./KnowledgeDetailsModal.css";

// Helper for source type icon
const getSourceIcon = (type) => {
  switch ((type || "").toLowerCase()) {
    case "youtube": return "▶️";
    case "pdf": return "📄";
    case "article": return "🌐";
    case "image": return "🖼️";
    case "note": return "📝";
    default: return "✦";
  }
};

// Canonical tag formatting
const formatCanonicalTag = (tag) => {
  if (!tag) return "";
  const cleaned = tag.trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const KnowledgeDetailsModal = ({ item, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const title = item.title || item.label || "Knowledge Details";
  const sourceType = item.sourceType || (item.type === "domain" ? "DOMAIN" : item.type === "tag" ? "TAG" : "NOTE");
  const summary = item.summary || item.data?.summary || "";
  const content = item.content || item.data?.content || "";
  const rawTags = item.tags || item.data?.tags || [];
  const rawTopics = item.topics || item.data?.topics || [];
  const sourceUrl = item.sourceUrl || item.data?.sourceUrl || "";
  const createdAt = item.createdAt || item.data?.createdAt;

  // Image URL check
  const imageUrl = item.imageUrl || item.fileUrl || item.data?.imageUrl || item.data?.fileUrl || "";

  console.log(`[IMAGE DEBUG] Modal open for Knowledge ID: ${item._id || item.id}`);
  console.log(`[IMAGE DEBUG] Image URL found: ${imageUrl || "NONE"}`);

  // Deduplicate and format tags
  const tags = [...new Set(rawTags.map(formatCanonicalTag))].filter(Boolean);
  const topics = [...new Set(rawTopics.map(formatCanonicalTag))].filter(Boolean);

  const isImage = (sourceType || "").toLowerCase() === "image" || title.toLowerCase().includes("screenshot") || title.toLowerCase().includes("image");

  return (
    <div
      className="details-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="details-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="details-modal-header">
          <div className="details-type-badge">
            <span className="type-icon">{getSourceIcon(sourceType)}</span>
            <span className="type-text">{sourceType.toUpperCase()}</span>
          </div>

          <button
            type="button"
            className="details-close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Title */}
        <h2 className="details-title">{title}</h2>

        {/* Date metadata */}
        {createdAt && (
          <div className="details-meta-date">
            Saved on {new Date(createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        )}

        {/* Image Display */}
        {imageUrl ? (
          <div className="details-image-wrapper" style={{ margin: "14px 0", textAlign: "center", background: "#06070a", borderRadius: "10px", padding: "10px", border: "1px solid #1f2330" }}>
            <img
              src={imageUrl}
              alt={title}
              style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "8px" }}
              onError={(e) => {
                console.warn("[IMAGE DEBUG] Image failed to load:", imageUrl);
              }}
            />
          </div>
        ) : isImage ? (
          <div style={{ margin: "12px 0", padding: "12px", border: "1px solid #7f1d1d", borderRadius: "10px", background: "rgba(127,29,29,0.15)", color: "#fca5a5" }}>
            <strong>Image file is unavailable.</strong>
            <small style={{ display: "block", color: "#f87171", fontSize: "10px", marginTop: "2px" }}>
              Original image URL reference was not stored for this entry. New image uploads will display automatically.
            </small>
          </div>
        ) : null}

        {/* Badges / Tags / Topics */}
        {(tags.length > 0 || topics.length > 0) && (
          <div className="details-badges-wrapper">
            {tags.map((t, idx) => (
              <span key={`tag-${idx}`} className="details-badge badge-tag">
                #{t}
              </span>
            ))}
            {topics.map((tp, idx) => (
              <span key={`topic-${idx}`} className="details-badge badge-topic">
                📁 {tp}
              </span>
            ))}
          </div>
        )}

        {/* AI Summary Section */}
        {summary && (
          <div className="details-section">
            <label className="details-section-label">✦ AI Summary</label>
            <div className="details-summary-box">{summary}</div>
          </div>
        )}

        {/* Content Preview / Extracted OCR Text */}
        {content && (
          <div className="details-section">
            <label className="details-section-label">
              {isImage ? "Extracted Image Content / OCR Text" : "Content Preview"}
            </label>
            <div className="details-content-box">{content}</div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="details-modal-actions">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="details-primary-link"
            >
              Open Source {sourceType === "youtube" ? "Video ▶" : "URL ↗"}
            </a>
          )}

          <button
            type="button"
            className="details-secondary-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default KnowledgeDetailsModal;
