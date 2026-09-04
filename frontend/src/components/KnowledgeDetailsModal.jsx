import { useEffect, useState } from "react";
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

/**
 * KnowledgeDetailsModal
 *
 * Props:
 *   item            — the knowledge item to show (or graph node)
 *   onClose         — close handler
 *   allKnowledge    — (optional) full list of user's knowledge for related lookup
 *   onOpenRelated   — (optional) callback(item) to open a related item's details
 */
const KnowledgeDetailsModal = ({ item, onClose, allKnowledge = [], onOpenRelated }) => {
  const [relatedItems, setRelatedItems] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Compute related knowledge from allKnowledge by matching graph relationships
  // or by shared tags/topics as fallback
  useEffect(() => {
    if (!item || !allKnowledge || allKnowledge.length === 0) {
      setRelatedItems([]);
      return;
    }

    const itemId = (item._id || item.knowledgeId || item.id || "").toString();
    const itemTags = new Set(
      [...(item.tags || []), ...(item.topics || [])].map((t) => t.toLowerCase().trim())
    );

    // Find items that share at least 2 tags/topics (excluding self)
    const related = allKnowledge
      .filter((k) => {
        const kid = k._id?.toString() || "";
        if (!kid || kid === itemId) return false;

        const kTags = [...(k.tags || []), ...(k.topics || [])].map((t) => t.toLowerCase().trim());
        const shared = kTags.filter((t) => itemTags.has(t));
        return shared.length >= 1 && itemTags.size > 0;
      })
      .map((k) => {
        const kTags = [...(k.tags || []), ...(k.topics || [])].map((t) => t.toLowerCase().trim());
        const sharedCount = kTags.filter((t) => itemTags.has(t)).length;
        return { ...k, _sharedCount: sharedCount };
      })
      .sort((a, b) => b._sharedCount - a._sharedCount)
      .slice(0, 5);

    setRelatedItems(related);
  }, [item, allKnowledge]);

  if (!item) return null;

  const title = item.title || item.label || "Knowledge Details";
  const sourceType = item.sourceType || (item.type === "domain" ? "DOMAIN" : item.type === "tag" ? "TAG" : "NOTE");
  const summary = item.summary || item.data?.summary || "";
  const content = item.content || item.data?.content || "";
  const rawTags = item.tags || item.data?.tags || [];
  const rawTopics = item.topics || item.data?.topics || [];
  const sourceUrl = item.sourceUrl || item.data?.sourceUrl || "";
  const createdAt = item.createdAt || item.data?.createdAt;
  const aiProcessed = item.aiProcessed !== undefined ? item.aiProcessed : true;

  const fileUrl = item.fileUrl || item.data?.fileUrl || "";
  const effectiveSourceUrl = sourceUrl || fileUrl;
  const isPdf = (sourceType || "").toLowerCase() === "pdf";

  // Image URL check
  const imageUrl = item.imageUrl || item.fileUrl || item.data?.imageUrl || item.data?.fileUrl || "";

  // Deduplicate and format tags
  const tags = [...new Set(rawTags.map(formatCanonicalTag))].filter(Boolean);
  const topics = [...new Set(rawTopics.map(formatCanonicalTag))].filter(Boolean);

  const isImage = (sourceType || "").toLowerCase() === "image" || title.toLowerCase().includes("screenshot") || title.toLowerCase().includes("image");

  const handleRelatedClick = (relatedItem) => {
    if (onOpenRelated) {
      onOpenRelated(relatedItem);
    }
  };

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

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* AI processing status */}
            {!aiProcessed && (
              <span className="details-ai-processing-badge">
                <span className="details-ai-spinner" />
                AI Analyzing...
              </span>
            )}
            {aiProcessed && (
              <span className="details-ai-done-badge">
                ✦ AI Analyzed
              </span>
            )}

            <button
              type="button"
              className="details-close-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
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
        {imageUrl && isImage ? (
          <div className="details-image-wrapper" style={{ margin: "14px 0", textAlign: "center", background: "#06070a", borderRadius: "10px", padding: "10px", border: "1px solid #1f2330" }}>
            <img
              src={imageUrl}
              alt={title}
              style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "8px" }}
              onError={() => {
                console.warn("[IMAGE DEBUG] Image failed to load:", imageUrl);
              }}
            />
          </div>
        ) : isImage ? (
          <div style={{ margin: "12px 0", padding: "12px", border: "1px solid #7f1d1d", borderRadius: "10px", background: "rgba(127,29,29,0.15)", color: "#fca5a5" }}>
            <strong>Image file is unavailable.</strong>
            <small style={{ display: "block", color: "#f87171", fontSize: "10px", marginTop: "2px" }}>
              Original image URL reference was not stored for this entry.
            </small>
          </div>
        ) : null}

        {/* PDF File Section */}
        {isPdf && (
          <div className="details-section" style={{ marginTop: "12px" }}>
            <label className="details-section-label">📄 PDF Attachment</label>
            {effectiveSourceUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", padding: "10px 14px", borderRadius: "10px" }}>
                <span style={{ fontSize: "20px" }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: "#e2e8f0", fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}.pdf
                  </span>
                  <a href={effectiveSourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", fontSize: "11px" }}>
                    {effectiveSourceUrl}
                  </a>
                </div>
                <a
                  href={effectiveSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Open PDF ↗
                </a>
              </div>
            ) : (
              <div style={{ padding: "10px 14px", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", background: "rgba(239,68,68,0.05)", color: "#f87171", fontSize: "12px" }}>
                📄 PDF file URL was not stored for this existing entry. Content text and AI summary remain available below.
              </div>
            )}
          </div>
        )}

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

        {/* Source URL (for non-PDFs) */}
        {!isPdf && effectiveSourceUrl && (
          <div className="details-section">
            <label className="details-section-label">🔗 Source</label>
            <div className="details-source-url">
              <a href={effectiveSourceUrl} target="_blank" rel="noopener noreferrer">
                {effectiveSourceUrl.length > 80 ? effectiveSourceUrl.substring(0, 80) + "..." : effectiveSourceUrl}
              </a>
            </div>
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
              {isImage ? "Extracted Image Content / OCR Text" : isPdf ? "Extracted PDF Text" : "Content Preview"}
            </label>
            <div className="details-content-box">{content}</div>
          </div>
        )}

        {/* Related Knowledge Section */}
        {relatedItems.length > 0 && (
          <div className="details-section">
            <label className="details-section-label">🔗 Related Knowledge</label>
            <div className="details-related-list">
              {relatedItems.map((rel) => (
                <button
                  key={rel._id}
                  className="details-related-item"
                  onClick={() => handleRelatedClick(rel)}
                  title={`Open: ${rel.title}`}
                >
                  <span className="related-item-icon">
                    {getSourceIcon(rel.sourceType)}
                  </span>
                  <div className="related-item-info">
                    <span className="related-item-title">{rel.title}</span>
                    {rel.summary && (
                      <span className="related-item-summary">
                        {rel.summary.length > 80
                          ? rel.summary.substring(0, 80) + "..."
                          : rel.summary}
                      </span>
                    )}
                  </div>
                  <span className="related-item-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="details-modal-actions">
          {effectiveSourceUrl && (
            <a
              href={effectiveSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="details-primary-link"
            >
              Open {isPdf ? "PDF Document 📄" : sourceType === "youtube" ? "Video ▶" : "Source URL ↗"}
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
