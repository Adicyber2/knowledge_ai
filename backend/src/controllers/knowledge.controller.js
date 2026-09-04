import mongoose from "mongoose";

import Knowledge from "../models/Knowledge.model.js";
import KnowledgeRelationship from "../models/KnowledgeRelationship.model.js";
import axios from "axios";
import {
  analyzeKnowledge,
  embedKnowledge,
  buildKnowledgeRelationships,
} from "../services/aiService.js";
import { uploadFileToImageKit } from "../services/imagekit.service.js";


// ============================================================
// HELPERS
// ============================================================

// Generic titles that AI might produce — we prefer AI title but fall back
const GENERIC_TITLE_PATTERNS = [
  /^article$/i, /^web page$/i, /^webpage$/i, /^website$/i,
  /^google search$/i, /^untitled$/i, /^unknown$/i, /^document$/i,
  /^content$/i, /^note$/i, /^reading$/i, /^link$/i, /^page$/i,
];

function isGenericTitle(title) {
  if (!title || !title.trim()) return true;
  const t = title.trim().toLowerCase();
  return GENERIC_TITLE_PATTERNS.some((p) => p.test(t)) || t.length < 5;
}

/**
 * Choose the best title: prefer AI-generated title unless it's generic.
 */
function chooseBestTitle(aiTitle, originalTitle) {
  if (aiTitle && !isGenericTitle(aiTitle)) {
    return aiTitle.trim();
  }
  return (originalTitle || "").trim() || "Saved Knowledge";
}


// ============================================================
// SHARED: AI PROCESSING PIPELINE
// Input text → AI analysis → save to MongoDB → embed to vector DB
//                         → async relationship building
// ============================================================

const MIN_CONTENT_LENGTH = 15;

const processAndSaveKnowledge = async ({
  userId,
  title,
  content,
  sourceType,
  sourceUrl,
  fileUrl,
  imageUrl,
}) => {

  // 1. Save to MongoDB first — set status to 'analyzing'
  const trimmedContent = (content || "").trim();
  // If user didn't provide a title, set a placeholder; AI will replace it
  const trimmedTitle = (title || "").trim() || "Analyzing...";

  const isShort = trimmedContent.length < MIN_CONTENT_LENGTH;

  const knowledge = await Knowledge.create({
    userId,
    title: trimmedTitle,
    content: trimmedContent,
    sourceType: sourceType || "note",
    sourceUrl: sourceUrl || "",
    fileUrl: fileUrl || imageUrl || "",
    imageUrl: imageUrl || fileUrl || "",
    aiAnalysisStatus: isShort ? "completed" : "analyzing",
    aiProcessed: isShort,
    aiAnalyzedAt: isShort ? new Date() : undefined,
    // 30-day expiry (default set by schema, but explicit here for clarity)
    expiresAt: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })(),
    isPermanent: false,
  });

  // 2. Short content check — skip AI call if content is insufficient
  if (isShort) {
    console.log(`[AI] Content too short (${trimmedContent.length} chars) for Knowledge ${knowledge._id}. Using original title.`);
    return knowledge;
  }

  // 3. AI Analysis + Embedding (non-blocking async)
  setImmediate(async () => {
    console.log("\n========================================");
    console.log("AI ANALYSIS START");
    console.log(`Knowledge ID: ${knowledge._id}`);
    console.log(`User ID: ${userId}`);

    try {
      console.log("AI REQUEST SENT");

      const aiData = await analyzeKnowledge({
        title: knowledge.title,
        content: knowledge.content,
        sourceType: knowledge.sourceType,
        sourceUrl: knowledge.sourceUrl,
      });

      console.log("AI RESPONSE RECEIVED");
      console.log("AI RESULT:", {
        title: aiData?.title,
        summary: aiData?.summary?.substring(0, 100),
        tags: aiData?.tags,
      });

      // Validate response
      if (!aiData) {
        throw new Error("AI service returned empty response");
      }

      const bestTitle = chooseBestTitle(aiData.title, knowledge.title);

      console.log("MONGODB UPDATE START");
      knowledge.title = bestTitle;
      knowledge.summary = aiData.summary || "";
      knowledge.category = aiData.category || "General";
      knowledge.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
      knowledge.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
      knowledge.entities = Array.isArray(aiData.entities) ? aiData.entities : [];
      knowledge.aiProcessed = true;
      knowledge.aiAnalysisStatus = "completed";
      knowledge.aiAnalyzedAt = new Date();
      knowledge.aiAnalysisError = "";
      knowledge.aiProvider = aiData.provider || "gemini";
      knowledge.aiModel = aiData.model || "";
      await knowledge.save();

      console.log("MONGODB UPDATE COMPLETE");
      console.log(`AI ANALYSIS FINISHED: "${bestTitle}"`);
      console.log("========================================\n");

      // Embed into vector DB
      embedKnowledge({
        knowledgeId: knowledge._id.toString(),
        userId: userId.toString(),
        title: bestTitle,
        content: knowledge.content,
        sourceType: knowledge.sourceType,
        sourceUrl: knowledge.sourceUrl,
      }).catch((err) => {
        console.error("[EMBED ERROR]:", err.message);
      });

      // Build knowledge graph relationships
      buildKnowledgeRelationships({
        userId,
        newKnowledgeId: knowledge._id,
        newTitle: bestTitle,
        newSummary: aiData.summary || "",
        newTags: Array.isArray(aiData.tags) ? aiData.tags : [],
        newTopics: Array.isArray(aiData.topics) ? aiData.topics : [],
        newEntities: Array.isArray(aiData.entities) ? aiData.entities : [],
        content: knowledge.content,
        Knowledge,
      }).catch((err) => {
        console.error("[GRAPH ERROR]:", err.message);
      });

    } catch (aiError) {
      console.error("AI ANALYSIS FAILED for Knowledge:", knowledge._id);
      console.error("ERROR REASON:", aiError.message);
      console.log("========================================\n");

      try {
        knowledge.aiAnalysisStatus = "failed";
        knowledge.aiAnalysisError = aiError.message || "AI Analysis failed";
        knowledge.aiProcessed = false;
        await knowledge.save();
      } catch (saveErr) {
        console.error("Failed to update status to failed:", saveErr.message);
      }
    }
  });

  return knowledge;
};


// ============================================================
// CREATE — Manual text/note entry
// ============================================================

export const createKnowledge = async (req, res) => {

  try {

    const {
      title,
      content,
      sourceType,
      sourceUrl,
      fileUrl,
      imageUrl,
    } = req.body;


    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Content is required",
      });
    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title: title || "",  // AI will generate title if empty
      content,
      sourceType: sourceType || "note",
      sourceUrl: sourceUrl || fileUrl || "",
      fileUrl: fileUrl || imageUrl || "",
      imageUrl: imageUrl || fileUrl || "",
    });

    return res.status(201).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {

    console.error("Create Knowledge Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create knowledge",
    });

  }

};


// ============================================================
// GET — List all user knowledge
// ============================================================

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


// ============================================================
// UPDATE — Edit existing knowledge
// ============================================================

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
          aiProcessed: false,
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

    // Re-run AI analysis + re-embed (async)
    setImmediate(async () => {
      try {
        const aiData = await analyzeKnowledge({
          title: knowledge.title,
          content: knowledge.content,
          sourceType: knowledge.sourceType,
          sourceUrl: knowledge.sourceUrl,
        });

        const bestTitle = chooseBestTitle(aiData.title, knowledge.title);

        knowledge.title = bestTitle;
        knowledge.summary = aiData.summary || "";
        knowledge.category = aiData.category || "General";
        knowledge.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
        knowledge.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
        knowledge.aiProcessed = true;
        await knowledge.save();

        await embedKnowledge({
          knowledgeId: knowledge._id.toString(),
          userId: req.userId.toString(),
          title: bestTitle,
          content: knowledge.content,
          sourceType: knowledge.sourceType,
          sourceUrl: knowledge.sourceUrl,
        });

        // Delete old relationships and rebuild
        await KnowledgeRelationship.deleteMany({
          userId: req.userId,
          $or: [
            { sourceKnowledgeId: knowledge._id },
            { targetKnowledgeId: knowledge._id },
          ],
        });

        buildKnowledgeRelationships({
          userId: req.userId,
          newKnowledgeId: knowledge._id,
          newTitle: bestTitle,
          newSummary: aiData.summary || "",
          newTags: Array.isArray(aiData.tags) ? aiData.tags : [],
          newTopics: Array.isArray(aiData.topics) ? aiData.topics : [],
          newEntities: Array.isArray(aiData.entities) ? aiData.entities : [],
          content: knowledge.content,
          Knowledge,
        }).catch(() => {});

      } catch (aiError) {
        console.error("AI/embedding update error:", aiError.message);
      }
    });

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


// ============================================================
// DELETE
// ============================================================

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

    // Also delete all graph relationships for this item
    await KnowledgeRelationship.deleteMany({
      userId: req.userId,
      $or: [
        { sourceKnowledgeId: id },
        { targetKnowledgeId: id },
      ],
    }).catch(() => {});

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


// ============================================================
// ACTIVITY — Last 7 days chart data
// ============================================================

export const getKnowledgeActivity = async (req, res) => {
  try {
    const days = 7;

    const startDate = new Date();

    startDate.setHours(0, 0, 0, 0);

    startDate.setDate(
      startDate.getDate() - (days - 1)
    );

    const userId = new mongoose.Types.ObjectId(
      req.userId
    );

    const activity = await Knowledge.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: startDate,
          },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },

          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const result = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);

      date.setDate(
        startDate.getDate() + i
      );

      const key =
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`;

      const found = activity.find(
        (item) => item._id === key
      );

      result.push({
        date: key,
        count: found
          ? found.count
          : 0,
      });
    }

    return res.status(200).json(result);

  } catch (error) {

    console.error("Activity Error:", error);

    return res.status(500).json({
      message: "Failed to fetch activity",
      error: error.message,
    });
  }
};


// ============================================================
// IMPORT: URL / Article
// ============================================================

export const importFromUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    // Basic URL validation
    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        message: "Only HTTP and HTTPS URLs are supported",
      });
    }

    // Duplicate check: if already saved by user, return existing record
    const existing = await Knowledge.findOne({
      userId: req.userId,
      sourceUrl: url.trim(),
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        data: existing,
        message: "Article already in vault.",
      });
    }

    // Fetch webpage
    let html;
    try {
      const response = await axios.get(url.trim(), {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; KnowledgeVaultBot/1.0)",
        },
        maxRedirects: 5,
      });
      html = response.data;
    } catch (fetchError) {
      return res.status(400).json({
        success: false,
        message: `Could not fetch URL. Please check the link and try again.`,
      });
    }

    // Extract text content using cheerio
    const { load } = await import("cheerio");
    const $ = load(html);

    // Remove noise elements
    $(
      "script, style, nav, header, footer, aside, iframe, noscript, [role=navigation], .cookie-banner, .ad, .advertisement"
    ).remove();

    // Extract title
    const pageTitle =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      parsedUrl.hostname;

    // Meta description fallback
    const metaDesc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";

    // Extract article/main content
    const articleText =
      $("article").text() ||
      $("main").text() ||
      $(".content, .article-body, .post-content, #content").text() ||
      $("body").text();

    let cleaned = articleText
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);

    if (!cleaned || cleaned.length < 20) {
      cleaned = metaDesc || pageTitle || `Saved webpage from ${parsedUrl.hostname}`;
    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title: pageTitle,
      content: cleaned,
      sourceType: "article",
      sourceUrl: url.trim(),
    });

    return res.status(201).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {
    console.error("URL Import Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import from URL",
    });
  }
};


// ============================================================
// IMPORT: YouTube
// ============================================================

export const importFromYoutube = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "YouTube URL is required",
      });
    }

    // Extract video ID
    const videoId = extractYouTubeId(url.trim());

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Could not extract a valid YouTube video ID from this URL",
      });
    }

    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Duplicate check for YouTube video URL
    const existingYt = await Knowledge.findOne({
      userId: req.userId,
      sourceUrl: targetUrl,
    });
    if (existingYt) {
      return res.status(200).json({
        success: true,
        data: existingYt,
        message: "YouTube video already in vault.",
      });
    }

    // Fetch transcript with fallback to title/description
    let transcriptText = "";
    let videoTitle = `YouTube Video (${videoId})`;

    // Try oEmbed for title first
    try {
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { timeout: 5000 }
      );
      if (oembedRes.data?.title) {
        videoTitle = oembedRes.data.title;
      }
    } catch {
      // Use default title
    }

    try {
      const { YoutubeTranscript } = await import("youtube-transcript");
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);

      if (transcript && transcript.length > 0) {
        transcriptText = transcript
          .map((item) => item.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 8000);
      }
    } catch {
      // Transcript unavailable
    }

    if (!transcriptText) {
      transcriptText = `YouTube Video: ${videoTitle}\nURL: ${targetUrl}\nNote: Saved video reference. Captions were not available for automated transcript extraction.`;
    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title: videoTitle,
      content: transcriptText,
      sourceType: "youtube",
      sourceUrl: targetUrl,
    });

    return res.status(201).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {
    console.error("YouTube Import Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import from YouTube",
    });
  }
};

const extractYouTubeId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  try {
    const parsed = new URL(url);
    const v = parsed.searchParams.get("v");
    if (v && v.length === 11) return v;
  } catch {
    // ignore
  }

  return null;
};


// ============================================================
// IMPORT: PDF
// ============================================================

export const importFromPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file uploaded",
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    if (mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are supported",
      });
    }

    if (size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "PDF file size must be under 10 MB",
      });
    }

    const title =
      originalname.replace(/\.pdf$/i, "").replace(/_/g, " ") ||
      "Imported PDF";

    let extractedText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      extractedText = data.text?.replace(/\s+/g, " ").trim() || "";
    } catch {
      // PDF parse failed or scanned PDF
    }

    if (!extractedText || extractedText.length < 10) {
      extractedText = `Uploaded PDF Document: ${title}\n(Scanned or binary PDF document uploaded to vault)`;
    }

    // Upload PDF file to ImageKit (/knowledge/pdfs/)
    let pdfUrl = "";
    try {
      const cleanFileName = `pdf_${Date.now()}_${originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      pdfUrl = await uploadFileToImageKit({
        buffer,
        fileName: cleanFileName,
        folder: "/knowledge/pdfs/",
      });
    } catch (uploadErr) {
      console.error("[PDF IMPORT] ImageKit upload error:", uploadErr.message);
      return res.status(500).json({
        success: false,
        message: uploadErr.message || "Failed to upload PDF file to ImageKit cloud storage",
      });
    }

    if (!pdfUrl) {
      return res.status(500).json({
        success: false,
        message: "ImageKit returned empty file URL for PDF upload",
      });
    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title,
      content: extractedText.substring(0, 8000),
      sourceType: "pdf",
      sourceUrl: pdfUrl,
      fileUrl: pdfUrl,
    });

    return res.status(201).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {
    console.error("PDF Import Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import PDF",
    });
  }
};


// ============================================================
// IMPORT: Image OCR (via Gemini Vision)
// ============================================================

export const importFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
    ];

    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported image format. Use JPEG, PNG, WebP, GIF, or BMP.",
      });
    }

    if (size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Image size must be under 10 MB",
      });
    }

    // Save image to disk under uploads/ directory
    const pathModule = await import("path");
    const fsModule = await import("fs");
    const ext = pathModule.default.extname(originalname) || ".jpg";
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const uploadPath = pathModule.default.join(process.cwd(), "uploads", filename);

    try {
      await fsModule.default.promises.writeFile(uploadPath, buffer);
    } catch (writeErr) {
      console.warn("Failed to write image file to disk:", writeErr.message);
    }

    const imageUrl = `http://localhost:3000/uploads/${filename}`;

    const base64Image = buffer.toString("base64");

    let ocrText = "";
    try {
      const response = await axios.post(
        `${process.env.AI_SERVICE_URL}/api/ai/ocr`,
        {
          imageBase64: base64Image,
          mimeType: mimetype,
        },
        { timeout: 30000 }
      );

      ocrText = response.data?.text?.trim() || "";
    } catch {
      // OCR service error fallback
    }

    const title =
      originalname
        .replace(/\.(jpg|jpeg|png|webp|gif|bmp)$/i, "")
        .replace(/_/g, " ") || "Imported Image";

    if (!ocrText || ocrText.length === 0) {
      ocrText = `Visual Image Document: ${title}\n(Uploaded image entry saved to vault)`;
    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title,
      content: ocrText.substring(0, 8000),
      sourceType: "image",
      sourceUrl: "",
      fileUrl: imageUrl,
      imageUrl: imageUrl,
    });

    console.log(`\n[IMAGE DEBUG] Knowledge ID: ${knowledge._id}`);
    console.log(`[IMAGE DEBUG] Stored Image URL: ${knowledge.imageUrl || knowledge.fileUrl}`);

    return res.status(201).json({
      success: true,
      data: knowledge,
    });

  } catch (error) {
    console.error("Image Import Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import image",
    });
  }
};


// ============================================================
// SEMANTIC SEARCH
// ============================================================

export const semanticSearch = async (req, res) => {
  try {
    const { query, limit = 8 } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Call Python vector service for semantic search
    const searchResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/ai/search`,
      {
        query: query.trim(),
        user_id: req.userId.toString(),
        limit: Math.min(Number(limit), 20),
      },
      { timeout: 15000 }
    );

    const ids = searchResponse.data?.ids?.[0] || [];
    const metadatas = searchResponse.data?.metadatas?.[0] || [];
    const distances = searchResponse.data?.distances?.[0] || [];

    if (ids.length === 0) {
      return res.status(200).json({
        success: true,
        results: [],
      });
    }

    // Fetch full knowledge documents from MongoDB
    const knowledgeItems = await Knowledge.find({
      _id: { $in: ids },
      userId: req.userId,
    });

    // Sort by vector distance order
    const sortedItems = ids
      .map((id, index) => {
        const item = knowledgeItems.find(
          (k) => k._id.toString() === id
        );
        if (!item) return null;
        return {
          ...item.toObject(),
          _relevanceScore: 1 - (distances[index] || 0),
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      results: sortedItems,
    });

  } catch (error) {
    console.error("Semantic Search Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Semantic search failed",
    });
  }
};


// ============================================================
// ANALYZE SINGLE KNOWLEDGE ITEM — manual re-trigger
// POST /knowledge/:id/analyze
// ============================================================

export const analyzeKnowledgeById = async (req, res) => {
  try {
    const { id } = req.params;

    const knowledge = await Knowledge.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!knowledge) {
      return res.status(404).json({
        success: false,
        message: "Knowledge not found",
      });
    }

    // Set status to analyzing
    knowledge.aiAnalysisStatus = "analyzing";
    knowledge.aiAnalysisError = "";
    await knowledge.save();

    console.log("\n========================================");
    console.log("MANUAL AI RE-ANALYZE START");
    console.log(`Knowledge ID: ${knowledge._id}`);
    console.log(`User ID: ${req.userId}`);

    // Short content check
    if ((knowledge.content || "").trim().length < MIN_CONTENT_LENGTH) {
      knowledge.aiProcessed = true;
      knowledge.aiAnalysisStatus = "completed";
      knowledge.aiAnalyzedAt = new Date();
      await knowledge.save();

      return res.status(200).json({
        success: true,
        data: knowledge,
        message: "Content too short for AI analysis. Original title retained.",
      });
    }

    // Run AI analysis
    let aiData;
    try {
      console.log("AI REQUEST SENT");
      aiData = await analyzeKnowledge({
        title: knowledge.title,
        content: knowledge.content,
        sourceType: knowledge.sourceType,
        sourceUrl: knowledge.sourceUrl,
      });

      console.log("AI RESPONSE RECEIVED:", {
        title: aiData?.title,
        summary: aiData?.summary?.substring(0, 100),
        tags: aiData?.tags,
      });

      if (!aiData || !aiData.title) {
        throw new Error("AI service returned incomplete result");
      }
    } catch (aiErr) {
      console.error("[ANALYZE] AI analysis failed:", aiErr.message);

      knowledge.aiAnalysisStatus = "failed";
      knowledge.aiAnalysisError = aiErr.message || "AI Analysis failed";
      knowledge.aiProcessed = false;
      await knowledge.save();

      return res.status(500).json({
        success: false,
        message: `AI analysis failed: ${aiErr.message}`,
        error: aiErr.message,
      });
    }

    console.log("MONGODB UPDATE START");
    const bestTitle = chooseBestTitle(aiData.title, knowledge.title);

    knowledge.title = bestTitle;
    knowledge.summary = aiData.summary || "";
    knowledge.category = aiData.category || "General";
    knowledge.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
    knowledge.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
    knowledge.entities = Array.isArray(aiData.entities) ? aiData.entities : [];
    knowledge.aiProcessed = true;
    knowledge.aiAnalysisStatus = "completed";
    knowledge.aiAnalyzedAt = new Date();
    knowledge.aiAnalysisError = "";
    await knowledge.save();

    console.log("MONGODB UPDATE COMPLETE");
    console.log(`MANUAL AI RE-ANALYZE FINISHED: "${bestTitle}"`);
    console.log("========================================\n");

    // Re-embed (async)
    embedKnowledge({
      knowledgeId: knowledge._id.toString(),
      userId: req.userId.toString(),
      title: bestTitle,
      content: knowledge.content,
      sourceType: knowledge.sourceType,
      sourceUrl: knowledge.sourceUrl,
    }).catch((err) => {
      console.error("[ANALYZE] Re-embed error:", err.message);
    });

    // Rebuild relationships (async)
    KnowledgeRelationship.deleteMany({
      userId: req.userId,
      $or: [
        { sourceKnowledgeId: knowledge._id },
        { targetKnowledgeId: knowledge._id },
      ],
    })
      .then(() =>
        buildKnowledgeRelationships({
          userId: req.userId,
          newKnowledgeId: knowledge._id,
          newTitle: bestTitle,
          newSummary: aiData.summary || "",
          newTags: Array.isArray(aiData.tags) ? aiData.tags : [],
          newTopics: Array.isArray(aiData.topics) ? aiData.topics : [],
          newEntities: Array.isArray(aiData.entities) ? aiData.entities : [],
          content: knowledge.content,
          Knowledge,
        })
      )
      .catch((err) => {
        console.error("[ANALYZE] Relationship rebuild error:", err.message);
      });

    return res.status(200).json({
      success: true,
      data: knowledge,
      message: "AI analysis complete",
    });

  } catch (error) {
    console.error("Analyze Knowledge Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to analyze knowledge",
      error: error.message,
    });
  }
};


// ============================================================
// BULK ANALYZE — process all unanalyzed knowledge for this user
// POST /knowledge/bulk-analyze
// ============================================================

export const bulkAnalyzeKnowledge = async (req, res) => {
  try {
    // Find items that are unanalyzed or failed
    const unprocessed = await Knowledge.find({
      userId: req.userId,
      $or: [
        { aiProcessed: false },
        { aiAnalysisStatus: "pending" },
        { aiAnalysisStatus: "failed" },
      ],
    }).limit(50);

    if (unprocessed.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All knowledge items are already analyzed.",
        processed: 0,
      });
    }

    // Immediately mark them all as 'analyzing' in DB so UI updates instantly
    const ids = unprocessed.map((item) => item._id);
    await Knowledge.updateMany(
      { _id: { $in: ids } },
      { $set: { aiAnalysisStatus: "analyzing", aiAnalysisError: "" } }
    );

    // Return 202 Accepted
    res.status(202).json({
      success: true,
      message: `Processing ${unprocessed.length} knowledge items in background. This may take a few minutes.`,
      total: unprocessed.length,
    });

    // Process sequentially with delay to avoid rate limits
    (async () => {
      let processedCount = 0;

      for (const item of unprocessed) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Short content check
          if ((item.content || "").trim().length < MIN_CONTENT_LENGTH) {
            item.aiProcessed = true;
            item.aiAnalysisStatus = "completed";
            item.aiAnalyzedAt = new Date();
            await item.save();
            processedCount++;
            continue;
          }

          const aiData = await analyzeKnowledge({
            title: item.title,
            content: item.content,
            sourceType: item.sourceType,
            sourceUrl: item.sourceUrl,
          });

          if (!aiData || !aiData.title) {
            throw new Error("AI service returned incomplete response");
          }

          const bestTitle = chooseBestTitle(aiData.title, item.title);

          item.title = bestTitle;
          item.summary = aiData.summary || "";
          item.category = aiData.category || "General";
          item.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
          item.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
          item.entities = Array.isArray(aiData.entities) ? aiData.entities : [];
          item.aiProcessed = true;
          item.aiAnalysisStatus = "completed";
          item.aiAnalyzedAt = new Date();
          item.aiAnalysisError = "";
          await item.save();

          // Embed (non-fatal)
          embedKnowledge({
            knowledgeId: item._id.toString(),
            userId: req.userId.toString(),
            title: bestTitle,
            content: item.content,
            sourceType: item.sourceType,
            sourceUrl: item.sourceUrl,
          }).catch(() => {});

          // Build relationships (non-fatal)
          buildKnowledgeRelationships({
            userId: req.userId,
            newKnowledgeId: item._id,
            newTitle: bestTitle,
            newSummary: aiData.summary || "",
            newTags: Array.isArray(aiData.tags) ? aiData.tags : [],
            newTopics: Array.isArray(aiData.topics) ? aiData.topics : [],
            newEntities: Array.isArray(aiData.entities) ? aiData.entities : [],
            content: item.content,
            Knowledge,
          }).catch(() => {});

          processedCount++;
          console.log(`[BULK ANALYZE] Processed ${processedCount}/${unprocessed.length}: "${bestTitle}"`);

        } catch (itemErr) {
          console.error(`[BULK ANALYZE] Failed item ${item._id}:`, itemErr.message);
          try {
            item.aiAnalysisStatus = "failed";
            item.aiAnalysisError = itemErr.message || "Bulk AI Analysis failed";
            item.aiProcessed = false;
            await item.save();
          } catch (e) {}
        }
      }

      console.log(`[BULK ANALYZE] Complete. Processed ${processedCount}/${unprocessed.length} items.`);
    })();

  } catch (error) {
    console.error("Bulk Analyze Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start bulk analysis",
      error: error.message,
    });
  }
};


// ============================================================
// KNOWLEDGE GRAPH — Hierarchical + Persisted AI Relationships
// ============================================================

// ============================================================
// KNOWLEDGE GRAPH — Direct semantic K2K relationships only
// No GENERAL hub, no domain/tag intermediary nodes.
// Nodes = Knowledge Items only.
// Edges = AI-determined relationships (persisted) + strict Jaccard fallback for orphans.
// ============================================================

// Classify a knowledge item's primary domain from its tags/topics
const DOMAIN_CLASSIFIERS = {
  "Frontend": ["react", "html", "css", "javascript", "typescript", "vue", "angular", "nextjs", "tailwind", "frontend", "ui", "dom", "jsx", "svelte", "webpack", "vite", "browser"],
  "Backend": ["node", "nodejs", "express", "python", "fastapi", "django", "flask", "java", "spring", "go", "rust", "backend", "api", "rest", "graphql", "server", "microservice"],
  "Database": ["mongodb", "mongoose", "sql", "postgres", "mysql", "redis", "database", "nosql", "chroma", "vector database", "supabase", "firebase"],
  "AI & ML": ["ai", "rag", "llm", "gemini", "openai", "gpt", "machine learning", "ml", "embedding", "embeddings", "vector", "ocr", "prompt", "transformer", "neural", "langchain", "chromadb"],
  "DevOps": ["docker", "kubernetes", "ci/cd", "github actions", "devops", "nginx", "deployment", "cloud", "aws", "gcp", "azure"],
  "Security": ["security", "auth", "oauth", "jwt", "encryption", "cybersecurity", "xss", "csrf"],
  "Mobile": ["react native", "flutter", "ios", "android", "mobile", "expo"],
};

const classifyDomain = (tags = [], topics = []) => {
  const allLabels = [...tags, ...topics].map((t) => (t || "").toLowerCase().trim());
  const scores = {};

  for (const [domain, keywords] of Object.entries(DOMAIN_CLASSIFIERS)) {
    let score = 0;
    for (const label of allLabels) {
      for (const kw of keywords) {
        if (label.includes(kw) || kw.includes(label)) {
          score++;
          break;
        }
      }
    }
    if (score > 0) scores[domain] = score;
  }

  if (Object.keys(scores).length === 0) return "General";
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
};

export const getKnowledgeGraph = async (req, res) => {
  try {
    const knowledgeItems = await Knowledge.find({
      userId: req.userId,
    }).sort({ createdAt: -1 });

    if (!knowledgeItems || knowledgeItems.length === 0) {
      return res.status(200).json({
        success: true,
        nodes: [],
        edges: [],
      });
    }

    // Fetch persisted AI-determined relationships for this user
    const aiRelationships = await KnowledgeRelationship.find({
      userId: req.userId,
    }).lean();

    const knowledgeIdSet = new Set(knowledgeItems.map((k) => k._id.toString()));

    // ---- Build Knowledge Nodes ONLY ----
    // Each node includes domain as metadata (for color-coding), not as a graph node
    const nodes = knowledgeItems.map((item) => {
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      const itemTopics = Array.isArray(item.topics) ? item.topics : [];
      const domain = classifyDomain(itemTags, itemTopics);

      return {
        id: `k-${item._id}`,
        label: item.title,                // AI-generated title shown in graph
        type: "knowledge",
        knowledgeId: item._id.toString(),
        domain,                           // Used for node color-coding only (not a graph node)
        sourceType: item.sourceType || "note",
        sourceUrl: item.sourceUrl || "",
        summary: item.summary || (item.content ? item.content.substring(0, 150) : ""),
        tags: itemTags,
        topics: itemTopics,
        aiProcessed: item.aiProcessed || false,
        createdAt: item.createdAt,
      };
    });

    // ---- Build Direct K2K Edges from AI Relationships ----
    const edges = [];
    const edgeSet = new Set();

    const addEdge = (edge) => {
      // Deduplicate: use canonical (smaller-id first) key to prevent A→B and B→A as separate edges
      const [lo, hi] = [edge.from, edge.to].sort();
      const key = `${lo}<->${hi}:${edge.relationship}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push(edge);
      }
    };

    for (const rel of aiRelationships) {
      const sourceId = rel.sourceKnowledgeId.toString();
      const targetId = rel.targetKnowledgeId.toString();

      // Only add edge if BOTH nodes belong to this user
      if (!knowledgeIdSet.has(sourceId) || !knowledgeIdSet.has(targetId)) continue;

      addEdge({
        from: `k-${sourceId}`,
        to: `k-${targetId}`,
        relationship: rel.relationshipType,
        label: rel.relationshipType.replace(/_/g, " "),
        confidence: rel.confidence,
        reason: rel.reason || "",
      });
    }

    // ---- Jaccard Fallback: ONLY for nodes with ZERO AI relationships ----
    // Strict threshold: must share 3+ tags/topics OR jaccard >= 0.45 with 2+ shared
    // This prevents weak spurious connections
    const itemsWithAnyRelationship = new Set();
    aiRelationships.forEach((r) => {
      if (knowledgeIdSet.has(r.sourceKnowledgeId.toString())) {
        itemsWithAnyRelationship.add(r.sourceKnowledgeId.toString());
      }
      if (knowledgeIdSet.has(r.targetKnowledgeId.toString())) {
        itemsWithAnyRelationship.add(r.targetKnowledgeId.toString());
      }
    });

    const orphanItems = knowledgeItems.filter(
      (k) => !itemsWithAnyRelationship.has(k._id.toString())
    );

    if (orphanItems.length > 0) {
      // Compare each orphan against ALL knowledge items (not just other orphans)
      for (const orphan of orphanItems) {
        for (const other of knowledgeItems) {
          if (orphan._id.toString() === other._id.toString()) continue;

          const tagsA = [...(orphan.tags || []), ...(orphan.topics || [])]
            .map((t) => t.toLowerCase().trim())
            .filter(Boolean);
          const tagsB = [...(other.tags || []), ...(other.topics || [])]
            .map((t) => t.toLowerCase().trim())
            .filter(Boolean);

          if (tagsA.length === 0 || tagsB.length === 0) continue;

          const setA = new Set(tagsA);
          const setB = new Set(tagsB);
          const intersection = [...setA].filter((x) => setB.has(x));
          const unionSize = new Set([...tagsA, ...tagsB]).size;
          const jaccardScore = unionSize > 0 ? intersection.length / unionSize : 0;

          // Strict threshold: 3+ shared terms OR jaccard >= 0.45 with 2+ shared
          const meetsThreshold =
            intersection.length >= 3 ||
            (jaccardScore >= 0.45 && intersection.length >= 2);

          if (meetsThreshold) {
            addEdge({
              from: `k-${orphan._id}`,
              to: `k-${other._id}`,
              relationship: "SEMANTICALLY_RELATED",
              label: `Shared: ${intersection.slice(0, 2).join(", ")}`,
              confidence: parseFloat(jaccardScore.toFixed(2)),
              reason: `Jaccard fallback — shares: ${intersection.slice(0, 3).join(", ")}`,
            });
          }
        }
      }
    }

    // Compute unique domains for stats (from node metadata, not graph nodes)
    const uniqueDomains = [...new Set(nodes.map((n) => n.domain).filter((d) => d !== "General"))];

    return res.status(200).json({
      success: true,
      nodes,
      edges,
      stats: {
        knowledgeItems: nodes.length,
        semanticEdges: edges.filter((e) => e.relationship !== "SEMANTICALLY_RELATED").length,
        jaccardEdges: edges.filter((e) => e.relationship === "SEMANTICALLY_RELATED").length,
        totalEdges: edges.length,
        domains: uniqueDomains,
        orphanNodes: orphanItems.length,
      },
    });
  } catch (error) {
    console.error("Get Knowledge Graph Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate knowledge graph",
    });
  }
};


// ============================================================
// REBUILD GRAPH RELATIONSHIPS
// Clears all existing AI relationships for user, then rebuilds
// them from scratch for all AI-processed knowledge items.
// POST /knowledge/graph/rebuild
// ============================================================

export const rebuildGraphRelationships = async (req, res) => {
  try {
    const userId = req.userId;

    console.log("\n========================================");
    console.log("GRAPH REBUILD START");
    console.log(`USER ID: ${userId}`);

    // 1. Delete ALL existing relationships for this user
    const deleted = await KnowledgeRelationship.deleteMany({
      userId,
    });

    console.log(`[GRAPH REBUILD] Cleared ${deleted.deletedCount} old relationships`);

    // 2. Fetch ALL knowledge items for this user
    const knowledgeItems = await Knowledge.find({
      userId,
    }).sort({ createdAt: -1 });

    console.log(`KNOWLEDGE COUNT: ${knowledgeItems.length}`);
    console.log("KNOWLEDGE ITEMS LOADED");

    if (knowledgeItems.length === 0) {
      console.log("GRAPH REBUILD COMPLETE: 0 Knowledge items in vault");
      console.log("========================================\n");
      return res.status(200).json({
        success: true,
        message: "No knowledge items found to build graph.",
        cleared: deleted.deletedCount,
        built: 0,
      });
    }

    // 3. Respond 202 Accepted immediately
    res.status(202).json({
      success: true,
      message: `Cleared ${deleted.deletedCount} old relationships. Rebuilding semantic graph for ${knowledgeItems.length} items in background.`,
      cleared: deleted.deletedCount,
      totalItems: knowledgeItems.length,
    });

    // 4. Background processing
    (async () => {
      let builtCount = 0;
      let embeddedCount = 0;

      for (let i = 0; i < knowledgeItems.length; i++) {
        const item = knowledgeItems[i];
        try {
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Step A: Analyze unanalyzed items first if needed
          if (!item.aiProcessed || !item.summary || !item.tags || item.tags.length === 0) {
            console.log(`[REBUILD AI ANALYZE] Processing unanalyzed item ${item._id}: "${item.title}"`);
            try {
              const aiData = await analyzeKnowledge({
                title: item.title,
                content: item.content,
                sourceType: item.sourceType,
                sourceUrl: item.sourceUrl,
              });

              if (aiData && aiData.title) {
                item.title = chooseBestTitle(aiData.title, item.title);
                item.summary = aiData.summary || "";
                item.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
                item.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
                item.entities = Array.isArray(aiData.entities) ? aiData.entities : [];
                item.aiProcessed = true;
                item.aiAnalysisStatus = "completed";
                item.aiAnalyzedAt = new Date();
                await item.save();
              }
            } catch (aErr) {
              console.warn(`[REBUILD AI ANALYZE NOTICE] AI analysis skipped for item ${item._id}:`, aErr.message);
            }
          }

          // Step B: Backfill embedding into ChromaDB
          try {
            await embedKnowledge({
              knowledgeId: item._id.toString(),
              userId: userId.toString(),
              title: item.title,
              content: item.content,
              sourceType: item.sourceType,
              sourceUrl: item.sourceUrl,
            });
            embeddedCount++;
            console.log(`[REBUILD EMBEDDING] Embedding stored for: "${item.title}"`);
          } catch (eErr) {
            console.warn(`[REBUILD EMBEDDING NOTICE] Vector embed warning for ${item._id}:`, eErr.message);
          }

          // Step C: Build relationships
          console.log(`[REBUILD RELATIONS] Analyzing candidates for (${i + 1}/${knowledgeItems.length}): "${item.title}"`);

          await buildKnowledgeRelationships({
            userId,
            newKnowledgeId: item._id,
            newTitle: item.title,
            newSummary: item.summary || "",
            newTags: Array.isArray(item.tags) ? item.tags : [],
            newTopics: Array.isArray(item.topics) ? item.topics : [],
            newEntities: Array.isArray(item.entities) ? item.entities : [],
            content: item.content || item.summary || item.title,
            Knowledge,
          });

          builtCount++;
        } catch (itemErr) {
          console.error(`[GRAPH REBUILD FAILED ITEM] ${item._id}:`, itemErr.message);
        }
      }

      // Count final saved relationships
      const finalRelCount = await KnowledgeRelationship.countDocuments({ userId });

      console.log("\n========================================");
      console.log("GRAPH REBUILD COMPLETE");
      console.log(`EMBEDDINGS PROCESSED: ${embeddedCount}/${knowledgeItems.length}`);
      console.log(`KNOWLEDGE ITEMS EVALUATED: ${builtCount}/${knowledgeItems.length}`);
      console.log(`RELATIONSHIPS SAVED IN DB: ${finalRelCount}`);
      console.log("========================================\n");
    })();

  } catch (error) {
    console.error("Rebuild Graph Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start graph rebuild",
      error: error.message,
    });
  }
};