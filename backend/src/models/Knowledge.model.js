import mongoose from "mongoose";

const knowledgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    sourceType: {
      type: String,
      enum: ["note", "article", "youtube", "pdf", "image"],
      default: "note",
    },

    sourceUrl: {
      type: String,
      default: "",
    },

    fileUrl: {
      type: String,
      default: "",
    },

    imageUrl: {
      type: String,
      default: "",
    },

    summary: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: String,
      },
    ],

    topics: [
      {
        type: String,
      },
    ],

    entities: [
      {
        type: String,
      },
    ],

    aiProcessed: {
      type: Boolean,
      default: false,
    },

    aiAnalysisStatus: {
      type: String,
      enum: ["pending", "analyzing", "completed", "failed"],
      default: "pending",
    },

    aiAnalysisError: {
      type: String,
      default: "",
    },

    aiAnalyzedAt: {
      type: Date,
    },

    aiProvider: {
      type: String,
      default: "",
    },

    aiModel: {
      type: String,
      default: "",
    },

    // ---- 30-day expiry system ----
    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d;
      },
    },

    isPermanent: {
      type: Boolean,
      default: false,
    },

    // Track if Day-25 notification has been sent (prevents duplicates)
    expiryNotificationSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Knowledge = mongoose.model("Knowledge", knowledgeSchema);

export default Knowledge;