// import userModel from "../models/user.model.js "
// import jwt from "jsonwebtoken"
// import {config} from "../config/config.js"

// --- (old commented code preserved above) ---

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";


const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + "_refresh");

// ============================================================
// REGISTER
// ============================================================

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};


// ============================================================
// LOGIN
// ============================================================

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email ? email.toLowerCase().trim() : "" });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        type: "access",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        type: "refresh",
      },
      getRefreshSecret(),
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};


// ============================================================
// REFRESH TOKEN
// POST /api/auth/refresh
// ============================================================

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: reqRefreshToken } = req.body;

    if (!reqRefreshToken) {
      return res.status(401).json({
        message: "Refresh token is required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(reqRefreshToken, getRefreshSecret());
    } catch (err) {
      return res.status(401).json({
        message: "Invalid or expired refresh token",
      });
    }

    if (decoded.type && decoded.type !== "refresh") {
      return res.status(401).json({
        message: "Invalid token type",
      });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        type: "access",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const newRefreshToken = jwt.sign(
      {
        userId: user._id,
        type: "refresh",
      },
      getRefreshSecret(),
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      token,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({
      message: "Token refresh failed",
    });
  }
};


// ============================================================
// GET CURRENT USER
// ============================================================

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      message: "Failed to fetch user profile",
    });
  }
};


// ============================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ============================================================

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // SECURITY: Always return the same message regardless of whether email exists
    // This prevents user enumeration attacks
    const successMessage =
      "If an account with that email exists, a password reset link has been sent.";

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Return success anyway — don't reveal that email doesn't exist
      return res.status(200).json({ message: successMessage });
    }

    // Generate a cryptographically secure random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Hash the token before storing — never store plain tokens in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    // Build the reset URL (frontend route)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // ---- Send email if SMTP is configured ----
    const smtpConfigured =
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS;

    if (smtpConfigured) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Knowledge Vault" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Reset your Knowledge Vault password",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #6366f1;">Knowledge Vault</h2>
              <p>You requested a password reset. Click the link below to set a new password:</p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">
                Reset Password
              </a>
              <p style="color:#6b7280;font-size:0.875rem;">
                This link expires in 1 hour. If you did not request this, please ignore this email.
              </p>
              <p style="color:#6b7280;font-size:0.875rem;">
                Or copy this URL: ${resetUrl}
              </p>
            </div>
          `,
        });

        console.log(`[AUTH] Password reset email sent to ${email}`);
      } catch (emailErr) {
        console.error("[AUTH] Failed to send reset email:", emailErr.message);
        // Don't fail the request — log the URL to console as fallback
        console.log(`[AUTH] RESET URL (fallback): ${resetUrl}`);
      }
    } else {
      // Log reset URL to console when email is not configured (for development)
      console.log("\n========================================");
      console.log("[AUTH] FORGOT PASSWORD — RESET URL:");
      console.log(resetUrl);
      console.log("(Configure SMTP_HOST/SMTP_USER/SMTP_PASS to send email)");
      console.log("========================================\n");
    }

    return res.status(200).json({ message: successMessage });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};


// ============================================================
// RESET PASSWORD
// POST /api/auth/reset-password
// ============================================================

export const resetPassword = async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;

    // Validate input
    if (!token || !email || !password) {
      return res.status(400).json({
        message: "Token, email and new password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // Hash the received token to compare with stored hashed token
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with matching hashed token AND non-expired token
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link. Please request a new one.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and invalidate the reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log(`[AUTH] Password successfully reset for: ${email}`);

    return res.status(200).json({
      message: "Password reset successfully. You can now log in.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      message: "Failed to reset password. Please try again.",
    });
  }
};