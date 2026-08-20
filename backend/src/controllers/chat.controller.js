import Chat from "../models/chat.model.js";

// CREATE CHAT
export const createChat = async (req, res) => {
  try {
    const {
      title = "New Chat",
      knowledgeIds = [],
    } = req.body;

    const chat = await Chat.create({
      userId: req.userId,
      title,
      knowledgeIds,
      messages: [],
    });

    res.status(201).json({
      message: "Chat created successfully",
      chat,
    });
  } catch (error) {
    console.error("Create Chat Error:", error);

    res.status(500).json({
      message: "Failed to create chat",
    });
  }
};

// GET ALL CHATS
export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      userId: req.userId,
    })
      .sort({ updatedAt: -1 })
      .select("title messages createdAt updatedAt");

    res.status(200).json({
      chats,
    });
  } catch (error) {
    console.error("Get Chats Error:", error);

    res.status(500).json({
      message: "Failed to fetch chats",
    });
  }
};


// GET SINGLE CHAT
export const getChat = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    res.status(200).json({
      chat,
    });
  } catch (error) {
    console.error("Get Chat Error:", error);

    res.status(500).json({
      message: "Failed to fetch chat",
    });
  }
};


// ADD MESSAGE
export const addMessage = async (req, res) => {
  try {
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        message: "Role and content are required",
      });
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    chat.messages.push({
      role,
      content,
    });

    // First user message → chat title
    if (
      role === "user" &&
      chat.title === "New Chat"
    ) {
      chat.title =
        content.length > 40
          ? `${content.substring(0, 40)}...`
          : content;
    }

    await chat.save();

    res.status(200).json({
      message: "Message saved successfully",
      chat,
    });
  } catch (error) {
    console.error("Add Message Error:", error);

    res.status(500).json({
      message: "Failed to save message",
    });
  }
};


// DELETE CHAT
export const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    res.status(200).json({
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete Chat Error:", error);

    res.status(500).json({
      message: "Failed to delete chat",
    });
  }
};