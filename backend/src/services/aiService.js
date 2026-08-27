import axios from "axios";

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL;


// Analyze content: returns { summary, tags, topics }
export const analyzeKnowledge = async ({
  title,
  content,
}) => {

  const response =
    await axios.post(
      `${AI_SERVICE_URL}/api/ai/analyze`,
      {
        title,
        content,
      },
      {
        timeout: 30000,
      }
    );


  return response.data;
};


// Store embedding in vector DB after MongoDB save
export const embedKnowledge = async ({
  knowledgeId,
  userId,
  title,
  content,
  sourceType,
  sourceUrl,
}) => {

  const response =
    await axios.post(
      `${AI_SERVICE_URL}/api/ai/process`,
      {
        knowledgeId,
        userId,
        title,
        content,
        sourceType: sourceType || "note",
        sourceUrl: sourceUrl || "",
      },
      {
        timeout: 30000,
      }
    );

  return response.data;
};