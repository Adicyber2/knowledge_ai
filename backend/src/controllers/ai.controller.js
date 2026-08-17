import axios from "axios";

export const askKnowledge = async (req, res) => {

  try {

    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/ai/ask`,
      {
        question,
        userId: req.userId
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