import axios from "axios";

import Knowledge from "../models/Knowledge.model.js";

export const askKnowledge = async (req, res) => {

  try {

    const {
  question,
  knowledgeIds = [],
} = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    const knowledge = await Knowledge.find({
  _id: { $in: knowledgeIds },
  userId: req.userId,
}).select("title content summary tags");

const context = knowledge
  .map((item) => {
    return `
Title: ${item.title}

Content:
${item.content}

Summary:
${item.summary || ""}

Tags:
${item.tags?.join(", ") || ""}
`;
  })
  .join("\n\n---\n\n");

   const response = await axios.post(
  `${process.env.AI_SERVICE_URL}/api/ai/ask`,
  {
    question,
    userId: req.userId,
    context,
  }
);

    res.json({
      answer: response.data.answer,
      sources: response.data.sources
    });

  } catch (error) {

    console.error(error.message);

    res.status(500).json({
      message: "Failed to generate answer"
    });
  }
};