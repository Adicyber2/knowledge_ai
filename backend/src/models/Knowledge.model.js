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
      enum: [
        "pdf",
        "article",
        "youtube",
        "text"
      ],
      default: "text",
    },

    sourceUrl: {
      type: String,
    },

    summary: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: String,
      }
    ],
  },
  {
    timestamps: true,
  }
);

const Knowledge = mongoose.model(
  "Knowledge",
  knowledgeSchema
);

export default Knowledge;