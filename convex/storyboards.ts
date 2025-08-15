import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createStoryboard = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    originalPrompt: v.string(),
    sceneCount: v.number(),
    estimatedCost: v.optional(v.number()),
  },
  returns: v.id("storyboards"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("storyboards", {
      userId: args.userId,
      title: args.title,
      originalPrompt: args.originalPrompt,
      status: "generating",
      sceneCount: args.sceneCount,
      estimatedCost: args.estimatedCost,
    });
  },
});

export const updateStoryboardStatus = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    status: v.union(
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partial")
    ),
    actualCost: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.actualCost !== undefined) {
      updates.actualCost = args.actualCost;
    }

    await ctx.db.patch(args.storyboardId, updates);
    return null;
  },
});

export const getUserStoryboards = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("storyboards"),
      _creationTime: v.number(),
      userId: v.id("users"),
      title: v.string(),
      originalPrompt: v.string(),
      status: v.union(
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("partial")
      ),
      sceneCount: v.number(),
      estimatedCost: v.optional(v.number()),
      actualCost: v.optional(v.number()),
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

export const getStoryboard = query({
  args: {
    storyboardId: v.id("storyboards"),
  },
  returns: v.union(
    v.object({
      _id: v.id("storyboards"),
      _creationTime: v.number(),
      userId: v.id("users"),
      title: v.string(),
      originalPrompt: v.string(),
      status: v.union(
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("partial")
      ),
      sceneCount: v.number(),
      estimatedCost: v.optional(v.number()),
      actualCost: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storyboardId);
  },
});

export const deleteStoryboard = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    userId: v.id("users"),
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