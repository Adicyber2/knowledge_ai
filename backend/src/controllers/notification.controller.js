import Notification from "../models/Notification.model.js";
import Knowledge from "../models/Knowledge.model.js";
import KnowledgeRelationship from "../models/KnowledgeRelationship.model.js";


// ============================================================
// GET all notifications for logged-in user
// GET /api/notifications
// ============================================================

export const getNotifications = async (req, res) => {
  try {
    // Clean up stale notifications where knowledge was already deleted
    // (non-fatal — do best effort)
    const notifications = await Notification.find({
      userId: req.userId,
    }).sort({ createdAt: -1 }).limit(50);

    // Filter out notifications for knowledge that no longer exists
    const knowledgeIds = notifications.map((n) => n.knowledgeId);
    const existingKnowledge = await Knowledge.find({
      _id: { $in: knowledgeIds },
      userId: req.userId,
    }).select("_id isPermanent expiresAt");

    const existingSet = new Set(
      existingKnowledge.map((k) => k._id.toString())
    );

    // Enrich notifications with current knowledge state
    const enriched = notifications
      .filter((n) => existingSet.has(n.knowledgeId.toString()))
      .map((n) => {
        const k = existingKnowledge.find(
          (k) => k._id.toString() === n.knowledgeId.toString()
        );
        return {
          ...n.toObject(),
          isPermanent: k?.isPermanent || false,
          expiresAt: k?.expiresAt || n.expiresAt,
        };
      });

    const unreadCount = enriched.filter((n) => !n.read).length;

    return res.status(200).json({
      success: true,
      notifications: enriched,
      unreadCount,
    });

  } catch (error) {
    console.error("Get Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};


// ============================================================
// MARK AS READ
// PATCH /api/notifications/:id/read
// ============================================================

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });

  } catch (error) {
    console.error("Mark Notification Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};


// ============================================================
// MARK ALL AS READ
// PATCH /api/notifications/read-all
// ============================================================

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });

  } catch (error) {
    console.error("Mark All Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};


// ============================================================
// KEEP PERMANENT — user chooses to keep knowledge forever
// PATCH /api/notifications/:id/keep-permanent
// ============================================================

export const keepKnowledgePermanent = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the notification (user-scoped)
    const notification = await Notification.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Mark the knowledge item as permanent (user-scoped for security)
    const knowledge = await Knowledge.findOneAndUpdate(
      {
        _id: notification.knowledgeId,
        userId: req.userId,
      },
      {
        isPermanent: true,
        expiresAt: null,           // Remove expiry date
      },
      { new: true }
    );

    if (!knowledge) {
      return res.status(404).json({
        success: false,
        message: "Knowledge item not found or already deleted",
      });
    }

    // Delete the notification since it's been acted on
    await Notification.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `"${knowledge.title}" is now kept permanently`,
      knowledge,
    });

  } catch (error) {
    console.error("Keep Permanent Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark as permanent",
    });
  }
};


// ============================================================
// DELETE NOW — user confirms immediate deletion
// DELETE /api/notifications/:id/delete-knowledge
// ============================================================

export const deleteKnowledgeFromNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Delete the knowledge item (user-scoped)
    await Knowledge.findOneAndDelete({
      _id: notification.knowledgeId,
      userId: req.userId,
    });

    // Clean up relationships
    await KnowledgeRelationship.deleteMany({
      userId: req.userId,
      $or: [
        { sourceKnowledgeId: notification.knowledgeId },
        { targetKnowledgeId: notification.knowledgeId },
      ],
    }).catch(() => {});

    // Delete the notification
    await Notification.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Knowledge deleted successfully",
    });

  } catch (error) {
    console.error("Delete from Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete knowledge",
    });
  }
};


// ============================================================
// DELETE notification (just dismiss it, don't delete knowledge)
// DELETE /api/notifications/:id
// ============================================================

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification dismissed",
    });

  } catch (error) {
    console.error("Delete Notification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to dismiss notification",
    });
  }
};
