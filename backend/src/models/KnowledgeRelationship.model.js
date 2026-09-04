import mongoose from "mongoose";

const VALID_RELATIONSHIP_TYPES = [
  "RELATED_TO",
  "PART_OF",
  "EXTENDS",
  "SIMILAR_TO",
  "PREREQUISITE_OF",
  "EXPLAINS",
  "USES",
  "ABOUT",
  "DEPENDS_ON",
  "BUILT_WITH",
  "USED_FOR",
];

const knowledgeRelationshipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sourceKnowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Knowledge",
      required: true,
    },

    targetKnowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Knowledge",
      required: true,
    },

    relationshipType: {
      type: String,
      enum: VALID_RELATIONSHIP_TYPES,
      required: true,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.7,
    },

    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index — prevents duplicate relationships
knowledgeRelationshipSchema.index(
  {
    userId: 1,
    sourceKnowledgeId: 1,
    targetKnowledgeId: 1,
    relationshipType: 1,
  },
  { unique: true }
);

// Index for fast lookup of all relationships for a knowledge item
knowledgeRelationshipSchema.index({ sourceKnowledgeId: 1, userId: 1 });
knowledgeRelationshipSchema.index({ targetKnowledgeId: 1, userId: 1 });

const KnowledgeRelationship = mongoose.model(
  "KnowledgeRelationship",
  knowledgeRelationshipSchema
);

export default KnowledgeRelationship;
export { VALID_RELATIONSHIP_TYPES };
