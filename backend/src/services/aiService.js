import axios from "axios";
import KnowledgeRelationship, { VALID_RELATIONSHIP_TYPES } from "../models/KnowledgeRelationship.model.js";

// Read lazily so dotenv has time to load before first use
const getAiUrl = () => {
  const url = process.env.AI_SERVICE_URL;
  if (!url) throw new Error("AI_SERVICE_URL is not set in environment variables");
  return url;
};

const CONFIDENCE_THRESHOLD = 0.60;
const MAX_RELATIONSHIP_CANDIDATES = 10;


// ============================================================
// ANALYZE: Get AI title, summary, tags, topics, entities
// Input text → Python AI service → structured JSON
// ============================================================

export const analyzeKnowledge = async ({ title, content, sourceType, sourceUrl }) => {

  const response = await axios.post(
    `${getAiUrl()}/api/ai/analyze`,
    {
      title,
      content,
      sourceType: sourceType || "article",
      sourceUrl: sourceUrl || null,
    },
    { timeout: 45000 }
  );

  return response.data;
};


// ============================================================
// EMBED: Store embedding in ChromaDB + get AI analysis
// ============================================================

export const embedKnowledge = async ({
  knowledgeId,
  userId,
  title,
  content,
  sourceType,
  sourceUrl,
}) => {

  const response = await axios.post(
    `${getAiUrl()}/api/ai/process`,
    {
      knowledgeId,
      userId,
      title,
      content,
      sourceType: sourceType || "note",
      sourceUrl: sourceUrl || "",
    },
    { timeout: 45000 }
  );

  return response.data;
};


// ============================================================
// FIND RELATED: Vector search to get candidates for relationship analysis
// ============================================================

const findCandidatesForRelationship = async (userId, newKnowledgeId, content, Knowledge) => {
  try {
    let vectorIds = [];

    // 1. Try vector similarity search first
    try {
      const searchResponse = await axios.post(
        `${getAiUrl()}/api/ai/search`,
        {
          query: (content || "").substring(0, 500),
          user_id: userId.toString(),
          limit: MAX_RELATIONSHIP_CANDIDATES + 1,
        },
        { timeout: 10000 }
      );
      vectorIds = (searchResponse.data?.ids?.[0] || []).filter(
        (id) => id !== newKnowledgeId.toString()
      );
    } catch (vErr) {
      console.warn("[AI SERVICE] Vector search candidate lookup notice:", vErr.message);
    }

    // 2. Query MongoDB for candidate items
    let vectorCandidates = [];
    if (vectorIds.length > 0) {
      vectorCandidates = await Knowledge.find({
        _id: { $in: vectorIds.slice(0, MAX_RELATIONSHIP_CANDIDATES) },
        userId: userId,
      }).select("_id title summary tags topics entities");
    }

    // 3. Fallback / Augment: If vector search yielded fewer candidates than MAX, fetch all other user items from MongoDB
    if (vectorCandidates.length < MAX_RELATIONSHIP_CANDIDATES) {
      const existingCandidateIds = new Set(
        vectorCandidates.map((c) => c._id.toString())
      );
      existingCandidateIds.add(newKnowledgeId.toString());

      const fallbackCandidates = await Knowledge.find({
        _id: { $nin: Array.from(existingCandidateIds) },
        userId: userId,
      })
        .sort({ createdAt: -1 })
        .limit(MAX_RELATIONSHIP_CANDIDATES - vectorCandidates.length)
        .select("_id title summary tags topics entities");

      return [...vectorCandidates, ...fallbackCandidates];
    }

    return vectorCandidates;
  } catch (err) {
    console.error("[AI SERVICE] findCandidatesForRelationship error:", err.message);
    // Ultimate fallback: return any other user knowledge items from MongoDB
    try {
      return await Knowledge.find({
        _id: { $ne: newKnowledgeId },
        userId: userId,
      })
        .limit(MAX_RELATIONSHIP_CANDIDATES)
        .select("_id title summary tags topics entities");
    } catch {
      return [];
    }
  }
};


// ============================================================
// BUILD RELATIONSHIPS: AI determines relationships + saves to DB
// Called asynchronously after knowledge is saved + embedded
// ============================================================

export const buildKnowledgeRelationships = async ({
  userId,
  newKnowledgeId,
  newTitle,
  newSummary,
  newTags,
  newTopics,
  newEntities,
  content,
  Knowledge,
}) => {
  try {
    // 1. Find candidate knowledge items via vector search
    const candidates = await findCandidatesForRelationship(
      userId,
      newKnowledgeId,
      content,
      Knowledge
    );

    if (candidates.length === 0) {
      console.log(`[GRAPH] No candidates found for relationship building (knowledgeId: ${newKnowledgeId})`);
      return;
    }

    console.log(`[GRAPH] Analyzing relationships for "${newTitle}" against ${candidates.length} candidates`);

    // 2. Ask Python AI service to determine relationships
    const candidatePayload = candidates.map((c) => ({
      id: c._id.toString(),
      title: c.title || "",
      summary: c.summary || "",
      tags: Array.isArray(c.tags) ? c.tags : [],
      topics: Array.isArray(c.topics) ? c.topics : [],
      entities: [],
    }));

    const relResponse = await axios.post(
      `${getAiUrl()}/api/ai/relationships`,
      {
        newKnowledgeId: newKnowledgeId.toString(),
        newTitle,
        newSummary,
        newTags: newTags || [],
        newTopics: newTopics || [],
        newEntities: newEntities || [],
        candidates: candidatePayload,
      },
      { timeout: 45000 }
    );

    const relationships = relResponse.data?.relationships || [];

    console.log(`[GRAPH] AI found ${relationships.length} potential relationships`);

    // 3. Filter by confidence threshold and validate relationship types
    const validRelationships = relationships.filter((r) => {
      const isValidType = VALID_RELATIONSHIP_TYPES.includes(r.type);
      const isConfident = (r.confidence || 0) >= CONFIDENCE_THRESHOLD;
      const hasTarget = r.targetKnowledgeId && r.targetKnowledgeId !== newKnowledgeId.toString();
      return isValidType && isConfident && hasTarget;
    });

    console.log(`[GRAPH] ${validRelationships.length} relationships passed confidence threshold (>= ${CONFIDENCE_THRESHOLD})`);

    // 4. Upsert relationships into MongoDB (prevent duplicates via unique index)
    let savedCount = 0;
    for (const rel of validRelationships) {
      try {
        await KnowledgeRelationship.findOneAndUpdate(
          {
            userId,
            sourceKnowledgeId: newKnowledgeId,
            targetKnowledgeId: rel.targetKnowledgeId,
            relationshipType: rel.type,
          },
          {
            userId,
            sourceKnowledgeId: newKnowledgeId,
            targetKnowledgeId: rel.targetKnowledgeId,
            relationshipType: rel.type,
            confidence: rel.confidence,
            reason: rel.reason || "",
          },
          { upsert: true, new: true }
        );
        savedCount++;
      } catch (dupErr) {
        // Ignore duplicate key errors (relationship already exists)
        if (dupErr.code !== 11000) {
          console.error("[GRAPH] Relationship upsert error:", dupErr.message);
        }
      }
    }

    console.log(`[GRAPH] Saved ${savedCount} new/updated relationships for "${newTitle}"`);

  } catch (err) {
    console.error("[GRAPH] buildKnowledgeRelationships error:", err.message);
    // Non-fatal — knowledge is already saved
  }
};


// ============================================================
// GET RELATED KNOWLEDGE: Fetch relationships for a given knowledge item
// Used in Knowledge Details Modal
// ============================================================

export const getRelatedKnowledge = async (knowledgeId, userId) => {
  try {
    const knowledgeIdStr = knowledgeId.toString();
    const userIdStr = userId.toString();

    // Find all relationships where this item is source or target
    const relationships = await KnowledgeRelationship.find({
      userId: userIdStr,
      $or: [
        { sourceKnowledgeId: knowledgeIdStr },
        { targetKnowledgeId: knowledgeIdStr },
      ],
    })
      .sort({ confidence: -1 })
      .limit(10);

    return relationships;
  } catch (err) {
    console.error("[GRAPH] getRelatedKnowledge error:", err.message);
    return [];
  }
};