import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  storyboards: defineTable({
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
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  scenes: defineTable({
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
  }).index("by_storyboard", ["storyboardId"])
    .index("by_storyboard_and_scene", ["storyboardId", "sceneNumber"]),

  generations: defineTable({
    storyboardId: v.id("storyboards"),
    type: v.union(v.literal("text"), v.literal("image")),
    sceneNumber: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    retryCount: v.number(),
    cost: v.optional(v.number()),
  }).index("by_storyboard", ["storyboardId"])
    .index("by_status", ["status"]),
});