import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";


// Internal mutation for creating storyboard from action
export const createStoryboard = internalMutation({
  args: {
    userId: v.string(), // Clerk user ID
    title: v.string(),
    logline: v.string(),
    originalPrompt: v.string(),
    storyAnchorContent: v.string(),
    status: v.union(
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partial")
    ),
    totalScenes: v.number(),
  },
  returns: v.id("storyboards"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("storyboards", {
      userId: args.userId,
      title: args.title,
      logline: args.logline,
      originalPrompt: args.originalPrompt,
      storyAnchorContent: args.storyAnchorContent,
      status: args.status,
      totalScenes: args.totalScenes,
    });
  },
});

// Internal mutation for updating storyboard from action
export const updateStoryboard = internalMutation({
  args: {
    id: v.id("storyboards"),
    status: v.union(
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partial")
    ),
    completedScenes: v.optional(v.number()),
    estimatedCost: v.optional(v.number()),
    actualCost: v.optional(v.number()),
    textCost: v.optional(v.number()),
    imagesCost: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.completedScenes !== undefined) updates.completedScenes = args.completedScenes;
    if (args.estimatedCost !== undefined) updates.estimatedCost = args.estimatedCost;
    if (args.actualCost !== undefined) updates.actualCost = args.actualCost;
    if (args.textCost !== undefined) updates.textCost = args.textCost;
    if (args.imagesCost !== undefined) updates.imagesCost = args.imagesCost;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

// Internal query for getting storyboard from actions
export const getStoryboardInternal = internalQuery({
  args: {
    id: v.id("storyboards"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Query for user storyboards (updated for new schema)
export const getUserStoryboards = query({
  args: {
    userId: v.string(), // Clerk user ID
  },
  returns: v.array(
    v.object({
      _id: v.id("storyboards"),
      _creationTime: v.number(),
      userId: v.string(),
      title: v.string(),
      logline: v.optional(v.string()),
      originalPrompt: v.string(),
      storyAnchorContent: v.optional(v.string()),
      status: v.union(
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("partial")
      ),
      // Support both old and new field names for backward compatibility
      sceneCount: v.optional(v.number()), // Legacy field name
      totalScenes: v.optional(v.number()), // New field name
      completedScenes: v.optional(v.number()),
      estimatedCost: v.optional(v.number()),
      actualCost: v.optional(v.number()),
      textCost: v.optional(v.number()),
      imagesCost: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyboards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const deleteStoryboard = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    userId: v.string(), // Clerk user ID
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const storyboard = await ctx.db.get(args.storyboardId);
    
    if (!storyboard) {
      throw new Error("Storyboard not found");
    }

    if (storyboard.userId !== args.userId) {
      throw new Error("Unauthorized: Cannot delete storyboard");
    }

    // Delete all scenes first
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
      .collect();

    for (const scene of scenes) {
      // Delete image from storage if it exists
      if (scene.imageStorageId) {
        await ctx.storage.delete(scene.imageStorageId);
      }
      await ctx.db.delete(scene._id);
    }

    // Delete all generation records
    const generations = await ctx.db
      .query("generations")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
      .collect();

    for (const generation of generations) {
      await ctx.db.delete(generation._id);
    }

    // Finally delete the storyboard
    await ctx.db.delete(args.storyboardId);
    return null;
  },
});