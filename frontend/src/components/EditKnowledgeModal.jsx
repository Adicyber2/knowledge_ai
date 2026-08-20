import { useState ,useEffect} from "react";

import {
  updateKnowledge,
} from "../service/knowledgeService";


const EditKnowledgeModal = ({
  item,
  onClose,
  onUpdated,
}) => {

 const [formData, setFormData] = useState({
  title: "",
  content: "",
  sourceType: "text",
  sourceUrl: "",
});

const [loading, setLoading] = useState(false);


  const [error, setError] =
    useState("");


    useEffect(() => {
  if (!knowledge) return;

  setFormData({
    title: knowledge.title || "",
    content: knowledge.content || "",
    sourceType: knowledge.sourceType || "text",
    sourceUrl: knowledge.sourceUrl || "",
  });
}, [knowledge]);


 const handleChange = (e) => {
  const { name, value } = e.target;

  setFormData((prev) => ({
    ...prev,
    [name]: value,
  }));
};


  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    setLoading(true);

    await updateKnowledge(
      knowledge._id,
      formData
    );

    onSaved();

  } catch (error) {
    console.error(
      "Update failed:",
      error.response?.data || error.message
    );

    alert(
      error.response?.data?.message ||
      "Failed to update knowledge"
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

        <div className="modal-header">

          <div>

            <span className="modal-eyebrow">
              KNOWLEDGE
            </span>

            <h2>
              Edit knowledge
            </h2>

            <p>
              Update your saved knowledge.
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


        {error && (

          <div className="auth-error">
            {error}
          </div>

        )}


        <form
          className="knowledge-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label>
              Title
            </label>

            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />

          </div>


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
              />

            </div>

          </div>


          <div className="form-group">

            <label>
              Content
            </label>

            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={8}
              required
            />

          </div>


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
                ? "Updating..."
                : "Save Changes →"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );
};


export default EditKnowledgeModal;
