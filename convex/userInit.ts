import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Initialize user in Convex when they first access the app
export const initializeUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { clerkId, email, name, imageUrl }) => {
    try {
      // Check if user already exists
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .first();

      if (existingUser) {
        // User already exists, return success
        return {
          success: true,
          userId: existingUser._id,
        };
      }

      // Create new user
      const userId = await ctx.db.insert("users", {
        clerkId,
        email: email || `user-${clerkId}@example.com`,
        name: name || "User",
        imageUrl,
      });

      console.log(`Created new user: ${clerkId}`);

      return {
        success: true,
        userId,
      };
    } catch (error) {
      console.error("Error initializing user:", error);
      return {
        success: false,
        error: "Failed to initialize user profile.",
      };
    }
  },
});