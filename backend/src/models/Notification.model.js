import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    knowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Knowledge",
      required: true,
    },

    knowledgeTitle: {
      type: String,
      default: "Knowledge Item",
    },

    // Notification type — currently only expiry_warning
    type: {
      type: String,
      enum: ["expiry_warning"],
      default: "expiry_warning",
    },

    // When does the knowledge expire (for display in notification)
    expiresAt: {
      type: Date,
      required: true,
    },

    // Days until expiry (at the time of notification creation)
    daysUntilExpiry: {
      type: Number,
      default: 5,
    },

    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient user-specific queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ knowledgeId: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
