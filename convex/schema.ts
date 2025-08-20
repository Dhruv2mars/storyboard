import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    // BYOK (Bring Your Own Key) fields
    hasApiKey: v.optional(v.boolean()), // Whether user has provided their own API key
    apiKeyHash: v.optional(v.string()), // Hashed version of API key for validation
    encryptedApiKey: v.optional(v.string()), // Encrypted API key for secure storage
    apiKeyUpdatedAt: v.optional(v.number()), // When API key was last updated
    byokEnabled: v.optional(v.boolean()), // Whether user wants to use their own key
  }).index("by_clerk_id", ["clerkId"]),

  storyboards: defineTable({
    userId: v.string(), // Clerk user ID
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
    totalScenes: v.number(),
    completedScenes: v.optional(v.number()),
    estimatedCost: v.optional(v.number()),
    actualCost: v.optional(v.number()),
    textCost: v.optional(v.number()),
    imagesCost: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  scenes: defineTable({
    storyboardId: v.id("storyboards"),
    sceneNumber: v.number(),
    sceneDescription: v.string(),
    sceneAction: v.string(),
    imagePrompt: v.optional(v.string()), // Complete image generation prompt
    imageStorageId: v.optional(v.id("_storage")),
    imageContentType: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    cost: v.optional(v.number()),
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

  storyboardQueue: defineTable({
    storyboardId: v.id("storyboards"),
    userId: v.string(), // Clerk user ID for tracking
    status: v.union(
      v.literal("queued"),
      v.literal("processing"), 
      v.literal("completed"),
      v.literal("failed")
    ),
    queuedAt: v.number(), // Timestamp when queued
    startedAt: v.optional(v.number()), // When processing started
    completedAt: v.optional(v.number()), // When completed
    retryCount: v.number(),
    error: v.optional(v.string()),
  }).index("by_status", ["status"])
    .index("by_queued_time", ["queuedAt"])
    .index("by_user", ["userId"])
    .index("by_storyboard", ["storyboardId"]),

  rateLimitTracker: defineTable({
    minute: v.number(), // Unix timestamp truncated to minute
    requestCount: v.number(),
    lastUpdated: v.number(),
  }).index("by_minute", ["minute"]),

  userRateLimitTracker: defineTable({
    userId: v.string(), // Clerk user ID for BYOK rate limiting
    minute: v.number(), // Unix timestamp truncated to minute
    requestCount: v.number(),
    lastUpdated: v.number(),
  }).index("by_user_and_minute", ["userId", "minute"])
    .index("by_user", ["userId"]),
});