import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation for creating scene from action
export const createScene = internalMutation({
  args: {
    storyboardId: v.id("storyboards"),
    sceneNumber: v.number(),
    sceneDescription: v.string(),
    sceneAction: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageContentType: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    cost: v.optional(v.number()),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("scenes", {
      storyboardId: args.storyboardId,
      sceneNumber: args.sceneNumber,
      sceneDescription: args.sceneDescription,
      sceneAction: args.sceneAction,
      imageStorageId: args.imageStorageId,
      imageContentType: args.imageContentType,
      status: args.status,
      cost: args.cost,
    });
  },
});

export const updateSceneImage = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    imageStorageId: v.id("_storage"),
    imageContentType: v.string(),
    imagePrompt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {
      imageStorageId: args.imageStorageId,
      imageContentType: args.imageContentType,
      status: "completed",
    };
    
    if (args.imagePrompt) {
      updates.imagePrompt = args.imagePrompt;
    }
    
    await ctx.db.patch(args.sceneId, updates);
    return null;
  },
});

export const updateSceneStatus = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      status: args.status,
    });
    return null;
  },
});

export const getStoryboardScenes = query({
  args: {
    storyboardId: v.id("storyboards"),
  },
  returns: v.array(
    v.object({
      _id: v.id("scenes"),
      _creationTime: v.number(),
      storyboardId: v.id("storyboards"),
      sceneNumber: v.number(),
      sceneDescription: v.string(),
      sceneAction: v.string(),
      imagePrompt: v.optional(v.string()),
      imageStorageId: v.optional(v.id("_storage")),
      imageContentType: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed")
      ),
      cost: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenes")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
      .order("asc")
      .collect();
  },
});

// Internal query for getting storyboard scenes
export const getStoryboardScenesInternal = internalQuery({
  args: {
    storyboardId: v.id("storyboards"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenes")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
      .order("asc")
      .collect();
  },
});

export const getScene = query({
  args: {
    sceneId: v.id("scenes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("scenes"),
      _creationTime: v.number(),
      storyboardId: v.id("storyboards"),
      sceneNumber: v.number(),
      sceneDescription: v.string(),
      sceneAction: v.string(),
      imagePrompt: v.optional(v.string()),
      imageStorageId: v.optional(v.id("_storage")),
      imageContentType: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed")
      ),
      cost: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sceneId);
  },
});

export const updateBatchSceneStatus = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
      .collect();

    for (const scene of scenes) {
      await ctx.db.patch(scene._id, {
        status: args.status,
      });
    }
    return null;
  },
});

// Query to get image URL from storage
export const getImageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Update scene cost
export const updateSceneCost = internalMutation({
  args: {
    sceneId: v.id("scenes"),
    cost: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      cost: args.cost,
    });
    return null;
  },
});