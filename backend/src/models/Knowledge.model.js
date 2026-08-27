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

    aiProcessed: {
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