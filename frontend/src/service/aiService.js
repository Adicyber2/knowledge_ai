// import axios from "axios";

// const AI_SERVICE_URL =
//   process.env.AI_SERVICE_URL;


// export const analyzeKnowledge =
//   async ({
//     title,
//     content,
//   }) => {

//     const response =
//       await axios.post(
//         `${AI_SERVICE_URL}/ai/analyze`,
//         {
//           title,
//           content,
//         },
//         {
//           timeout: 30000,
//         }
//       );


//     return response.data;
//   };


import api from "./api";

export const askAI = async (message, knowledgeIds = []) => {
  const response = await api.post("/ai/chat", {
    message,
    knowledgeIds,
  });

  return response.data;
};