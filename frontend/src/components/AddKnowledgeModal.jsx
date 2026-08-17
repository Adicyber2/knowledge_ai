import { useState } from "react";
import { createKnowledge } from "../service/knowledgeService";
import "./AddKnowledgeModal.css";

const AddKnowledgeModal = ({
  onClose,
  onSaved,
}) => {

  const [form, setForm] = useState({
    title: "",
    content: "",
    sourceUrl: "",
    sourceType: "note",
    tags: "",
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  };


 const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    setLoading(true);

  const newKnowledge = await createKnowledge(form);

    console.log("Knowledge created:", newKnowledge);

    onClose();

  } catch (error) {
    console.error(
      "Failed to create knowledge:",
      error.response?.data || error.message
    );

    alert(
      error.response?.data?.message ||
      "Failed to create knowledge"
    );
  } finally {
    setLoading(false);
  }
};


  return (

    <div
      className="modal-backdrop"
      onMouseDown={(e) => {

        if (
          e.target === e.currentTarget
        ) {
          onClose();
        }

      }}
    >

      <div
        className="knowledge-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
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
              Save something you want
              to remember.
            </p>

          </div>


          <button
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>

        </div>


        {/* Error */}

        {error && (

          <div className="auth-error">
            {error}
          </div>

        )}


        {/* Form */}

        <form
          className="knowledge-form"
          onSubmit={handleSubmit}
        >

          {/* Title */}

          <div className="form-group">

            <label>
              Title
            </label>

            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Understanding RAG"
              required
            />

          </div>


          {/* Type + URL */}

          <div className="form-row">

            <div className="form-group">

              <label>
                Source Type
              </label>

              <select
                name="sourceType"
                value={form.sourceType}
                onChange={handleChange}
              >

                <option value="note">
                  Note
                </option>

                <option value="article">
                  Article
                </option>

                <option value="youtube">
                  YouTube
                </option>

                <option value="pdf">
                  PDF
                </option>

              </select>

            </div>


            <div className="form-group">

              <label>
                Source URL
              </label>

              <input
                name="sourceUrl"
                type="url"
                value={form.sourceUrl}
                onChange={handleChange}
                placeholder="https://..."
              />

            </div>

          </div>


          {/* Content */}

          <div className="form-group">

            <label>
              Content
            </label>

            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              placeholder="Write or paste your knowledge here..."
              rows={8}
              required
            />

          </div>


          {/* Tags */}

          <div className="form-group">

            <label>
              Tags
              <span className="label-hint">
                optional — AI can generate them
              </span>
            </label>

            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="AI, RAG, LLM"
            />

          </div>


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
                ? "Saving..."
                : "Save Knowledge →"}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
};

export default AddKnowledgeModal;