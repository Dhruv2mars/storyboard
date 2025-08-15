import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createScene = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    sceneNumber: v.number(),
    description: v.string(),
    imagePrompt: v.string(),
  },
  returns: v.id("scenes"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("scenes", {
      storyboardId: args.storyboardId,
      sceneNumber: args.sceneNumber,
      description: args.description,
      imagePrompt: args.imagePrompt,
      status: "pending",
    });
  },
});

export const updateSceneImage = mutation({
  args: {
    sceneId: v.id("scenes"),
    imageId: v.id("_storage"),
    imageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      imageId: args.imageId,
      imageUrl: args.imageUrl,
      status: "completed",
    });
    return null;
  },
});

export const updateSceneStatus = mutation({
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
      description: v.string(),
      imagePrompt: v.string(),
      imageId: v.optional(v.id("_storage")),
      imageUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed")
      ),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenes")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", args.storyboardId))
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
      description: v.string(),
      imagePrompt: v.string(),
      imageId: v.optional(v.id("_storage")),
      imageUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed")
      ),
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