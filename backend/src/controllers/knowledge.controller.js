import Knowledge from "../models/Knowledge.model.js";
import axios from "axios";
import {
  analyzeKnowledge,
} from "../services/aiService.js";

// CREATE KNOWLEDGE
export const createKnowledge =
  async (req, res) => {

    try {

      const {
        title,
        content,
        sourceType,
        sourceUrl,
      } = req.body;


      if (
        !title?.trim() ||
        !content?.trim()
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Title and content are required",
        });

      }


      // 1️⃣ Save first

      const knowledge =
        await Knowledge.create({

          userId: req.userId,

          title: title.trim(),

          content: content.trim(),

          sourceType:
            sourceType || "note",

          sourceUrl:
            sourceUrl || "",

        });


      // 2️⃣ Send to Python AI service

      try {

        const aiData =
          await analyzeKnowledge({

            title:
              knowledge.title,

            content:
              knowledge.content,

          });


        // 3️⃣ Save AI result

        knowledge.summary =
          aiData.summary || "";


        knowledge.tags =
          Array.isArray(aiData.tags)
            ? aiData.tags
            : [];


        knowledge.topics =
          Array.isArray(aiData.topics)
            ? aiData.topics
            : [];


        knowledge.aiProcessed =
          true;


        await knowledge.save();


      } catch (aiError) {

        console.error(
          "Python AI service error:",
          aiError.message
        );

      }


      return res.status(201).json({

        success: true,

        data: knowledge,

      });


    } catch (error) {

      console.error(error);

      return res.status(500).json({

        success: false,

        message:
          "Failed to create knowledge",

      });

    }

  };


// GET ALL KNOWLEDGE
export const getKnowledge = async (req, res) => {
  try {
    const knowledge = await Knowledge.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      knowledge
    });

  } catch (error) {
    console.error("Get Knowledge Error:", error);

    return res.status(500).json({
      message: "Failed to fetch knowledge",
      error: error.message
    });
  }
};


// DELETE KNOWLEDGE
export const updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      content,
      sourceType,
      sourceUrl,
    } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const knowledge =
      await Knowledge.findOneAndUpdate(
        {
          _id: id,
          userId: req.userId,
        },
        {
          title: title.trim(),
          content: content.trim(),
          sourceType: sourceType || "note",
          sourceUrl: sourceUrl || "",
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!knowledge) {
      return res.status(404).json({
        success: false,
        message: "Knowledge not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update knowledge",
    });
  }
};


export const deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;

    const knowledge =
      await Knowledge.findOneAndDelete({
        _id: id,
        userId: req.userId,
      });

    if (!knowledge) {
      return res.status(404).json({
        success: false,
        message: "Knowledge not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Knowledge deleted successfully",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete knowledge",
    });
  }
};