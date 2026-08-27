import { useState } from "react";
import {
  createKnowledge,
  importFromUrl,
  importFromYoutube,
  importFromPdf,
  importFromImage,
} from "../service/knowledgeService";
import "./AddKnowledgeModal.css";


// ---- TAB CONFIG ----
const TABS = [
  { id: "note",    label: "📝 Note",       title: "Write a note" },
  { id: "url",     label: "🌐 URL",         title: "Import from article/URL" },
  { id: "youtube", label: "▶️ YouTube",     title: "Import YouTube video" },
  { id: "pdf",     label: "📄 PDF",         title: "Upload a PDF" },
  { id: "image",   label: "🖼️ Image / OCR", title: "OCR from image" },
];


const AddKnowledgeModal = ({ onClose, onSaved }) => {

  const [activeTab, setActiveTab] = useState("note");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Note form
  const [form, setForm] = useState({
    title: "",
    content: "",
    sourceUrl: "",
    sourceType: "note",
  });

  // URL form
  const [urlInput, setUrlInput] = useState("");

  // YouTube form
  const [ytInput, setYtInput] = useState("");

  // PDF form
  const [pdfFile, setPdfFile] = useState(null);

  // Image form
  const [imageFile, setImageFile] = useState(null);


  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };


  const reset = () => {
    setError("");
    setSuccess("");
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();

    try {
      setLoading(true);

      let saved;

      switch (activeTab) {

        case "note": {
          if (!form.title.trim() || !form.content.trim()) {
            setError("Title and content are required.");
            return;
          }
          saved = await createKnowledge(form);
          break;
        }

        case "url": {
          if (!urlInput.trim()) {
            setError("Please enter a URL.");
            return;
          }
          setSuccess("Fetching and analysing article...");
          saved = await importFromUrl(urlInput.trim());
          break;
        }

        case "youtube": {
          if (!ytInput.trim()) {
            setError("Please enter a YouTube URL.");
            return;
          }
          setSuccess("Fetching transcript and analysing...");
          saved = await importFromYoutube(ytInput.trim());
          break;
        }

        case "pdf": {
          if (!pdfFile) {
            setError("Please select a PDF file.");
            return;
          }
          setSuccess("Extracting text from PDF...");
          saved = await importFromPdf(pdfFile);
          break;
        }

        case "image": {
          if (!imageFile) {
            setError("Please select an image.");
            return;
          }
          setSuccess("Running OCR on image...");
          saved = await importFromImage(imageFile);
          break;
        }

        default:
          break;
      }

      setSuccess("✓ Knowledge saved and analysed!");

      setTimeout(() => {
        onSaved(saved);
      }, 800);

    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
      // Clear success if we got an error
      if (error) setSuccess("");
    }
  };


  const currentTab = TABS.find((t) => t.id === activeTab);


  return (

    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >

      <div
        className="knowledge-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >

        {/* Header */}

        <div className="modal-header">

          <div>
            <span className="modal-eyebrow">
              KNOWLEDGE
            </span>

            <h2>
              Add to your vault
            </h2>

            <p>
              {currentTab?.title}
            </p>
          </div>


          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            ×
          </button>

        </div>


        {/* Tabs */}

        <div className="import-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`import-tab ${activeTab === tab.id ? "import-tab-active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                reset();
              }}
              disabled={loading}
            >
              {tab.label}
            </button>
          ))}
        </div>


        {/* Status messages */}

        {error && (
          <div className="auth-error" style={{ marginTop: "12px" }}>
            {error}
          </div>
        )}

        {success && !error && (
          <div className="import-success">
            {success}
          </div>
        )}


        {/* Form */}

        <form className="knowledge-form" onSubmit={handleSubmit}>


          {/* ===================== NOTE ===================== */}

          {activeTab === "note" && (
            <>
              <div className="form-group">
                <label>Title</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Understanding RAG"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Source Type</label>
                  <select
                    name="sourceType"
                    value={form.sourceType}
                    onChange={handleChange}
                  >
                    <option value="note">Note</option>
                    <option value="article">Article</option>
                    <option value="youtube">YouTube</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Source URL</label>
                  <input
                    name="sourceUrl"
                    type="url"
                    value={form.sourceUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  name="content"
                  value={form.content}
                  onChange={handleChange}
                  placeholder="Write or paste your knowledge here..."
                  rows={8}
                  required
                />
              </div>
            </>
          )}


          {/* ===================== URL ===================== */}

          {activeTab === "url" && (
            <div className="form-group">
              <label>Article / Webpage URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                required
              />
              <small className="import-hint">
                We'll extract the article text, generate a summary and tags automatically.
              </small>
            </div>
          )}


          {/* ===================== YOUTUBE ===================== */}

          {activeTab === "youtube" && (
            <div className="form-group">
              <label>YouTube URL</label>
              <input
                type="url"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                required
              />
              <small className="import-hint">
                Supports youtube.com/watch, youtu.be, and youtube.com/shorts links.
                Video must have captions enabled.
              </small>
            </div>
          )}


          {/* ===================== PDF ===================== */}

          {activeTab === "pdf" && (
            <div className="form-group">
              <label>PDF File</label>
              <div
                className="file-drop-zone"
                onClick={() => document.getElementById("pdf-input").click()}
              >
                {pdfFile ? (
                  <div className="file-selected">
                    <span>📄</span>
                    <span>{pdfFile.name}</span>
                    <span className="file-size">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span style={{ fontSize: "32px" }}>📄</span>
                    <p>Click to select a PDF</p>
                    <small>Max 10 MB • Text-based PDFs only</small>
                  </div>
                )}
              </div>
              <input
                id="pdf-input"
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => setPdfFile(e.target.files[0] || null)}
              />
            </div>
          )}


          {/* ===================== IMAGE ===================== */}

          {activeTab === "image" && (
            <div className="form-group">
              <label>Image (OCR)</label>
              <div
                className="file-drop-zone"
                onClick={() => document.getElementById("image-input").click()}
              >
                {imageFile ? (
                  <div className="file-selected">
                    <span>🖼️</span>
                    <span>{imageFile.name}</span>
                    <span className="file-size">
                      {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span style={{ fontSize: "32px" }}>🖼️</span>
                    <p>Click to select an image</p>
                    <small>JPEG, PNG, WebP, GIF • Max 5 MB</small>
                  </div>
                )}
              </div>
              <input
                id="image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                style={{ display: "none" }}
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
              <small className="import-hint">
                Powered by Gemini Vision AI — extracts text from photos, screenshots, and documents.
              </small>
            </div>
          )}


          {/* Buttons */}

          <div className="modal-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>


            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : "Save Knowledge →"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
};

export default AddKnowledgeModal;