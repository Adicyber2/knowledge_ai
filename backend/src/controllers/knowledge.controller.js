import mongoose from "mongoose";

import Knowledge from "../models/Knowledge.model.js";
import axios from "axios";
import {
  analyzeKnowledge,
  embedKnowledge,
} from "../services/aiService.js";


// ============================================================
// SHARED: AI PROCESSING PIPELINE
// Input text → AI analysis → save to MongoDB → embed to vector DB
// ============================================================

const processAndSaveKnowledge = async ({
  userId,
  title,
  content,
  sourceType,
  sourceUrl,
  fileUrl,
  imageUrl,
}) => {

  // 1. Save to MongoDB first (without AI data)
  const knowledge = await Knowledge.create({
    userId,
    title: title.trim(),
    content: content.trim(),
    sourceType: sourceType || "note",
    sourceUrl: sourceUrl || "",
    fileUrl: fileUrl || imageUrl || "",
    imageUrl: imageUrl || fileUrl || "",
  });

  // 2. AI Analysis + Embedding (non-blocking on failure)
  try {

    const aiData = await analyzeKnowledge({
      title: knowledge.title,
      content: knowledge.content,
    });

    knowledge.summary = aiData.summary || "";
    knowledge.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
    knowledge.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
    knowledge.aiProcessed = true;

    await knowledge.save();

    // 3. Embed into vector DB
    await embedKnowledge({
      knowledgeId: knowledge._id.toString(),
      userId: userId.toString(),
      title: knowledge.title,
      content: knowledge.content,
      sourceType: knowledge.sourceType,
      sourceUrl: knowledge.sourceUrl,
    });

  } catch (aiError) {
    console.error("AI/embedding pipeline error:", aiError.message);
    // Knowledge is already saved — AI failure is non-fatal
  }

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
    } = req.body;


    if (!title?.trim() || !content?.trim()) {

      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });

    }

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title,
      content,
      sourceType: sourceType || "note",
      sourceUrl: sourceUrl || "",
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

    // Re-run AI analysis + re-embed
    try {
      const aiData = await analyzeKnowledge({
        title: knowledge.title,
        content: knowledge.content,
      });

      knowledge.summary = aiData.summary || "";
      knowledge.tags = Array.isArray(aiData.tags) ? aiData.tags : [];
      knowledge.topics = Array.isArray(aiData.topics) ? aiData.topics : [];
      knowledge.aiProcessed = true;

      await knowledge.save();

      await embedKnowledge({
        knowledgeId: knowledge._id.toString(),
        userId: req.userId.toString(),
        title: knowledge.title,
        content: knowledge.content,
        sourceType: knowledge.sourceType,
        sourceUrl: knowledge.sourceUrl,
      });

    } catch (aiError) {
      console.error("AI/embedding update error:", aiError.message);
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

    const knowledge = await processAndSaveKnowledge({
      userId: req.userId,
      title,
      content: extractedText.substring(0, 8000),
      sourceType: "pdf",
      sourceUrl: "",
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
// KNOWLEDGE GRAPH — HIERARCHICAL & RELATIONSHIPS
// ============================================================

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

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();
    const edgeSet = new Set();

    const addNode = (node) => {
      if (!nodeSet.has(node.id)) {
        nodeSet.add(node.id);
        nodes.push(node);
      }
    };

    const addEdge = (edge) => {
      const key = `${edge.from}->${edge.to}:${edge.relationship}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push(edge);
      }
    };

    // Domain classifier
    const domainMap = {
      FRONTEND: ["react", "html", "css", "javascript", "js", "ts", "typescript", "vue", "angular", "tailwind", "ui", "frontend", "web", "nextjs", "vite"],
      BACKEND: ["node", "nodejs", "express", "python", "fastapi", "django", "java", "spring", "backend", "api", "rest", "graphql", "server"],
      DATABASE: ["mongodb", "mongoose", "sql", "postgres", "postgresql", "redis", "database", "db", "chroma", "vector"],
      "AI & ML": ["ai", "rag", "llm", "gemini", "openai", "machine learning", "ml", "embeddings", "vector", "ocr", "prompt"],
    };

    const getDomainForTag = (tag) => {
      const lower = (tag || "").toLowerCase().trim();
      for (const [domain, keywords] of Object.entries(domainMap)) {
        if (keywords.some((k) => lower.includes(k))) {
          return domain;
        }
      }
      return "GENERAL";
    };

    const domainsUsed = new Set();

    knowledgeItems.forEach((item) => {
      const knId = `k-${item._id}`;
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      const itemTopics = Array.isArray(item.topics) ? item.topics : [];
      const allLabels = [...new Set([...itemTags, ...itemTopics])];

      // Add Knowledge Node
      addNode({
        id: knId,
        label: item.title,
        type: "knowledge",
        sourceType: item.sourceType || "note",
        sourceUrl: item.sourceUrl || "",
        summary: item.summary || (item.content ? item.content.substring(0, 150) : ""),
        tags: itemTags,
        topics: itemTopics,
        createdAt: item.createdAt,
      });

      if (allLabels.length === 0) {
        const domainId = "domain-GENERAL";
        domainsUsed.add("GENERAL");
        addNode({
          id: domainId,
          label: "GENERAL",
          type: "domain",
        });
        addEdge({
          from: domainId,
          to: knId,
          relationship: "SOURCE_OF_TOPIC",
          label: "Contains",
        });
      }

      allLabels.forEach((label) => {
        const cleanLabel = label.trim();
        if (!cleanLabel) return;

        const subtopicId = `subtopic-${cleanLabel.toLowerCase()}`;
        const domain = getDomainForTag(cleanLabel);
        const domainId = `domain-${domain}`;
        domainsUsed.add(domain);

        addNode({
          id: domainId,
          label: domain,
          type: "domain",
        });

        addNode({
          id: subtopicId,
          label: cleanLabel,
          type: "tag",
          domain: domain,
        });

        addEdge({
          from: domainId,
          to: subtopicId,
          relationship: "SOURCE_OF_TOPIC",
          label: "Parent Domain",
        });

        addEdge({
          from: subtopicId,
          to: knId,
          relationship: "SAME_TOPIC",
          label: "Belongs To",
        });
      });
    });

    // Compute inter-knowledge semantic relationships (strict pruning for real relationships)
    for (let i = 0; i < knowledgeItems.length; i++) {
      for (let j = i + 1; j < knowledgeItems.length; j++) {
        const itemA = knowledgeItems[i];
        const itemB = knowledgeItems[j];

        const tagsA = [...(itemA.tags || []), ...(itemA.topics || [])].map((t) => t.toLowerCase().trim()).filter(Boolean);
        const tagsB = [...(itemB.tags || []), ...(itemB.topics || [])].map((t) => t.toLowerCase().trim()).filter(Boolean);

        const setA = new Set(tagsA);
        const setB = new Set(tagsB);

        const intersection = [...setA].filter((x) => setB.has(x));
        const unionSize = new Set([...tagsA, ...tagsB]).size;

        const jaccardScore = unionSize > 0 ? intersection.length / unionSize : 0;

        // Strict threshold: only connect if 2+ shared tags/topics OR jaccard similarity >= 0.35
        if (intersection.length >= 2 || (jaccardScore >= 0.35 && intersection.length >= 1)) {
          addEdge({
            from: `k-${itemA._id}`,
            to: `k-${itemB._id}`,
            relationship: "SEMANTICALLY_RELATED",
            label: `Shared: ${intersection.slice(0, 2).join(", ")}`,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      nodes,
      edges,
    });
  } catch (error) {
    console.error("Get Knowledge Graph Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate knowledge graph",
    });
  }
};