import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    knowledgeId: String,
    title: String,
    sourceType: String,
    sourceUrl: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    sources: {
      type: [sourceSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      default: "New Chat",
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    knowledgeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Knowledge",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;