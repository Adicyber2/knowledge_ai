import axios from "axios";
import Knowledge from "../models/Knowledge.model.js";
import { embedKnowledge } from "../services/aiService.js";

export const askKnowledge = async (req, res) => {
  try {
    const { question, knowledgeIds = [] } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    const userIdStr = req.userId.toString();
    const queryStr = question.trim();

    console.log(`\n==================================================`);
    console.log(`[RAG DEBUG] AI Query Received`);
    console.log(`[RAG DEBUG] User ID: ${userIdStr}`);
    console.log(`[RAG DEBUG] Question: "${queryStr}"`);
    console.log(`==================================================`);

    let finalContext = "";
    let candidateSources = [];
    const seenIds = new Set();

    // -----------------------------------------------------------
    // MODE A: Explicit Knowledge Selection (if manual IDs passed)
    // -----------------------------------------------------------
    if (Array.isArray(knowledgeIds) && knowledgeIds.length > 0) {
      console.log(`[RAG DEBUG] Mode: Manual Selection (${knowledgeIds.length} IDs)`);

      const manualItems = await Knowledge.find({
        _id: { $in: knowledgeIds },
        userId: req.userId,
      }).select("title content summary tags sourceType sourceUrl");

      manualItems.forEach((item) => {
        seenIds.add(item._id.toString());
        candidateSources.push({
          knowledgeId: item._id.toString(),
          title: item.title,
          sourceType: item.sourceType || "note",
          sourceUrl: item.sourceUrl || "",
        });
      });

      finalContext = manualItems
        .map(
          (item, i) =>
            `SOURCE ${i + 1} (${item.title}):\nTitle: ${item.title}\nContent:\n${item.content}\nSummary:\n${item.summary || ""}`
        )
        .join("\n\n---\n\n");

    } else {

      // -----------------------------------------------------------
      // MODE B: Automatic RAG (Hybrid Retrieval across User Vault)
      // -----------------------------------------------------------
      console.log(`[RAG DEBUG] Mode: Automatic Vault RAG (Hybrid Retrieval)`);

      // 1. Extract search keywords from question
      const stopWords = new Set(["what", "is", "define", "the", "a", "an", "for", "to", "how", "do", "i", "can", "you", "tell", "me", "about", "show", "my", "saved", "knowledge", "explain", "which"]);
      const keywords = queryStr
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !stopWords.has(w));

      console.log(`[RAG DEBUG] Extracted Keywords:`, keywords);

      // 2. MongoDB Keyword Candidate Search for this user
      let mongoCandidates = [];
      if (keywords.length > 0) {
        const regexes = keywords.map((k) => new RegExp(k, "i"));

        mongoCandidates = await Knowledge.find({
          userId: req.userId,
          $or: [
            { title: { $in: regexes } },
            { content: { $in: regexes } },
            { summary: { $in: regexes } },
            { tags: { $in: regexes } },
            { topics: { $in: regexes } },
          ],
        })
          .limit(8)
          .select("title content summary tags topics sourceType sourceUrl");
      } else {
        // Fallback: fetch recent user knowledge items
        mongoCandidates = await Knowledge.find({ userId: req.userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title content summary tags topics sourceType sourceUrl");
      }

      console.log(`[RAG DEBUG] MongoDB Keyword Candidates Found: ${mongoCandidates.length}`);
      mongoCandidates.forEach((item, i) => {
        console.log(`   [Mongo ${i + 1}] Title: "${item.title}" | Type: ${item.sourceType}`);
      });

      // 3. Auto-Backfill Embeddings: ensure user's MongoDB docs have embeddings in ChromaDB
      const allUserItems = await Knowledge.find({ userId: req.userId }).select("title content sourceType sourceUrl");
      allUserItems.forEach((item) => {
        embedKnowledge({
          knowledgeId: item._id.toString(),
          userId: userIdStr,
          title: item.title,
          content: item.content,
          sourceType: item.sourceType,
          sourceUrl: item.sourceUrl,
        }).catch(() => {});
      });

      // 4. ChromaDB Vector Candidate Search
      let vectorCandidates = [];
      try {
        const searchResponse = await axios.post(
          `${process.env.AI_SERVICE_URL}/api/ai/search`,
          {
            query: queryStr,
            user_id: userIdStr,
            limit: 8,
          },
          { timeout: 10000 }
        );

        const ids = searchResponse.data?.ids?.[0] || [];
        const metadatas = searchResponse.data?.metadatas?.[0] || [];
        const distances = searchResponse.data?.distances?.[0] || [];

        console.log(`[RAG DEBUG] Vector Search Candidates Found: ${ids.length}`);

        if (ids.length > 0) {
          const vectorKnowledgeItems = await Knowledge.find({
            _id: { $in: ids },
            userId: req.userId,
          }).select("title content summary tags topics sourceType sourceUrl");

          vectorCandidates = ids
            .map((id, idx) => {
              const item = vectorKnowledgeItems.find((k) => k._id.toString() === id);
              if (!item) return null;
              return {
                item,
                distance: distances[idx] || 1.0,
                metadata: metadatas[idx] || {},
              };
            })
            .filter(Boolean);
        }
      } catch (vectorErr) {
        console.warn(`[RAG DEBUG] Vector Search Warning (using MongoDB candidates fallback):`, vectorErr.message);
      }

      // 5. Merge & Deduplicate candidates (MongoDB Keyword + Vector)
      const mergedItems = [];

      // Add vector candidates first
      vectorCandidates.forEach(({ item }) => {
        const idStr = item._id.toString();
        if (!seenIds.has(idStr)) {
          seenIds.add(idStr);
          mergedItems.push(item);
        }
      });

      // Add Mongo keyword candidates
      mongoCandidates.forEach((item) => {
        const idStr = item._id.toString();
        if (!seenIds.has(idStr)) {
          seenIds.add(idStr);
          mergedItems.push(item);
        }
      });

      console.log(`[RAG DEBUG] Total Merged Candidates for Context: ${mergedItems.length}`);

      if (mergedItems.length > 0) {
        finalContext = mergedItems
          .map(
            (item, i) =>
              `SOURCE ${i + 1} (${item.title}):\nTitle: ${item.title}\nSource Type: ${item.sourceType || "note"}\nContent:\n${item.content}\nSummary:\n${item.summary || ""}`
          )
          .join("\n\n---\n\n");

        candidateSources = mergedItems.map((item) => ({
          knowledgeId: item._id.toString(),
          title: item.title,
          sourceType: item.sourceType || "note",
          sourceUrl: item.sourceUrl || "",
        }));
      }
    }

    console.log(`[RAG DEBUG] Final Context Built (${finalContext.length} chars)`);
    console.log(`[RAG DEBUG] Forwarding query to Python AI Service /api/ai/ask...`);

    // 5. Call Python RAG Service
    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/ai/ask`,
      {
        question: queryStr,
        userId: userIdStr,
        context: finalContext,
      },
      { timeout: 35000 }
    );

    const answer = response.data?.answer || "No response generated.";
    const sources = (response.data?.sources && response.data.sources.length > 0)
      ? response.data.sources
      : candidateSources;

    console.log(`[RAG DEBUG] Gemini Response Received (${answer.length} chars)`);
    console.log(`[RAG DEBUG] Sources Returned: ${sources.length}`);
    console.log(`==================================================\n`);

    return res.status(200).json({
      success: true,
      answer,
      sources,
    });

  } catch (error) {
    console.error("Ask Knowledge Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: true,
      message: "AI Service Error: Failed to generate answer.",
      details: error.message,
    });
  }
};