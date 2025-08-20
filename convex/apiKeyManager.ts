import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Simple encryption/decryption for demo purposes
// In production, use proper encryption with env-stored keys
const ENCRYPTION_KEY = "storyboard-api-key-encryption-2025"; // Should be in env

function simpleEncrypt(text: string): string {
  // Simple XOR encryption for demo - use proper encryption in production
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  // Convert to base64 without Buffer
  return btoa(result);
}

function simpleDecrypt(encrypted: string): string {
  // Convert from base64 without Buffer
  const text = atob(encrypted);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return result;
}

function hashApiKey(apiKey: string): string {
  // Simple hash for validation - use proper hashing in production
  // Convert to base64 without Buffer
  return btoa(apiKey).slice(0, 16);
}

// Validate API key format (Gemini API keys start with AIza)
function isValidGeminiApiKey(apiKey: string): boolean {
  return apiKey.startsWith('AIza') && apiKey.length >= 39;
}

// Set user's API key (BYOK)
export const setUserApiKey = mutation({
  args: {
    userId: v.string(),
    apiKey: v.string(),
    userName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { userId, apiKey, userName, userEmail }) => {
    try {
      // Validate API key format
      if (!isValidGeminiApiKey(apiKey)) {
        return {
          success: false,
          error: "Invalid API key format. Please ensure you're using a valid Gemini API key from Google AI Studio.",
        };
      }

      // Check if user exists, create if not
      let user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
        .first();

      if (!user) {
        // Create user if they don't exist
        try {
          const userId_new = await ctx.db.insert("users", {
            clerkId: userId,
            email: userEmail || `user-${userId}@example.com`,
            name: userName || "User",
          });
          
          user = await ctx.db.get(userId_new);
          if (!user) {
            return {
              success: false,
              error: "Failed to create user profile. Please try again.",
            };
          }
        } catch (createError) {
          console.error("Error creating user:", createError);
          return {
            success: false,
            error: "Failed to create user profile. Please try again.",
          };
        }
      }

      // Encrypt the API key
      const encryptedApiKey = simpleEncrypt(apiKey);
      const apiKeyHash = hashApiKey(apiKey);

      // Update user with encrypted API key
      await ctx.db.patch(user._id, {
        hasApiKey: true,
        apiKeyHash,
        encryptedApiKey,
        apiKeyUpdatedAt: Date.now(),
        byokEnabled: true,
      });

      console.log(`User ${userId} set their API key (BYOK enabled)`);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error setting user API key:", error);
      return {
        success: false,
        error: "Failed to save API key. Please try again.",
      };
    }
  },
});

// Remove user's API key
export const removeUserApiKey = mutation({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { userId }) => {
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found.",
        };
      }

      // Remove API key fields
      await ctx.db.patch(user._id, {
        hasApiKey: false,
        apiKeyHash: undefined,
        encryptedApiKey: undefined,
        apiKeyUpdatedAt: undefined,
        byokEnabled: false,
      });

      console.log(`User ${userId} removed their API key (BYOK disabled)`);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error removing user API key:", error);
      return {
        success: false,
        error: "Failed to remove API key. Please try again.",
      };
    }
  },
});

// Get user's BYOK status (public info only)
export const getUserBYOKStatus = query({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    hasApiKey: v.boolean(),
    byokEnabled: v.boolean(),
    apiKeyUpdatedAt: v.optional(v.number()),
  }),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user) {
      return {
        hasApiKey: false,
        byokEnabled: false,
      };
    }

    return {
      hasApiKey: user.hasApiKey || false,
      byokEnabled: user.byokEnabled || false,
      apiKeyUpdatedAt: user.apiKeyUpdatedAt,
    };
  },
});

// Internal function to get decrypted API key for use in actions
export const getUserApiKeyInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    if (!user || !user.encryptedApiKey || !user.byokEnabled) {
      return null;
    }

    try {
      return simpleDecrypt(user.encryptedApiKey);
    } catch (error) {
      console.error("Error decrypting user API key:", error);
      return null;
    }
  },
});

// Toggle BYOK on/off (user can temporarily disable without removing key)
export const toggleBYOK = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { userId, enabled }) => {
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found.",
        };
      }

      // Can only enable if user has an API key
      if (enabled && !user.hasApiKey) {
        return {
          success: false,
          error: "Please add an API key first before enabling BYOK.",
        };
      }

      await ctx.db.patch(user._id, {
        byokEnabled: enabled,
      });

      console.log(`User ${userId} ${enabled ? 'enabled' : 'disabled'} BYOK`);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error toggling BYOK:", error);
      return {
        success: false,
        error: "Failed to update BYOK status. Please try again.",
      };
    }
  },
});

// Internal function to check if user should use their own key
export const shouldUseBYOK = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    return (user?.hasApiKey && user?.byokEnabled) || false;
  },
});