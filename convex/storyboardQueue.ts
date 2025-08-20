import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Add storyboard to queue
export const addToQueue = internalMutation({
  args: {
    storyboardId: v.id("storyboards"),
    userId: v.string(),
  },
  returns: v.id("storyboardQueue"),
  handler: async (ctx, { storyboardId, userId }) => {
    const now = Date.now();
    
    return await ctx.db.insert("storyboardQueue", {
      storyboardId,
      userId,
      status: "queued",
      queuedAt: now,
      retryCount: 0,
    });
  },
});

// Get next storyboard from queue (FIFO)
export const getNextQueueItem = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("storyboardQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc") // Get oldest first (FIFO)
      .first();
  },
});

// Update queue item status
export const updateQueueItemStatus = internalMutation({
  args: {
    queueItemId: v.id("storyboardQueue"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { queueItemId, status, error, startedAt, completedAt }) => {
    const updates: any = { status };
    
    if (error) updates.error = error;
    if (startedAt) updates.startedAt = startedAt;
    if (completedAt) updates.completedAt = completedAt;
    
    await ctx.db.patch(queueItemId, updates);
    return null;
  },
});

// Increment retry count for failed item
export const incrementRetryCount = internalMutation({
  args: {
    queueItemId: v.id("storyboardQueue"),
  },
  returns: v.null(),
  handler: async (ctx, { queueItemId }) => {
    const item = await ctx.db.get(queueItemId);
    if (!item) return null;
    
    await ctx.db.patch(queueItemId, {
      retryCount: item.retryCount + 1,
      status: "queued", // Reset to queued for retry
    });
    return null;
  },
});

// Get queue status for a specific storyboard
export const getStoryboardQueueStatus = query({
  args: {
    storyboardId: v.id("storyboards"),
  },
  returns: v.union(
    v.object({
      _id: v.id("storyboardQueue"),
      _creationTime: v.number(),
      storyboardId: v.id("storyboards"),
      userId: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      queuedAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      retryCount: v.number(),
      error: v.optional(v.string()),
      position: v.optional(v.number()), // Queue position
    }),
    v.null()
  ),
  handler: async (ctx, { storyboardId }) => {
    const queueItem = await ctx.db
      .query("storyboardQueue")
      .withIndex("by_storyboard", (q) => q.eq("storyboardId", storyboardId))
      .first();
    
    if (!queueItem) return null;
    
    // Calculate queue position if item is still queued
    let position: number | undefined;
    if (queueItem.status === "queued") {
      const queuedItems = await ctx.db
        .query("storyboardQueue")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .order("asc") // Ordered by queuedAt
        .collect();
      
      position = queuedItems.findIndex(item => item._id === queueItem._id) + 1;
    }
    
    return {
      ...queueItem,
      position,
    };
  },
});

// Get overall queue statistics
export const getQueueStats = query({
  args: {},
  returns: v.object({
    totalQueued: v.number(),
    totalProcessing: v.number(),
    totalCompleted: v.number(),
    totalFailed: v.number(),
    estimatedWaitTime: v.number(), // In minutes
  }),
  handler: async (ctx) => {
    const allItems = await ctx.db.query("storyboardQueue").collect();
    
    const totalQueued = allItems.filter(i => i.status === "queued").length;
    const totalProcessing = allItems.filter(i => i.status === "processing").length;
    const totalCompleted = allItems.filter(i => i.status === "completed").length;
    const totalFailed = allItems.filter(i => i.status === "failed").length;
    
    // Estimate wait time: assume each storyboard takes about 1 minute to process
    // and we can process 1 every 6 seconds (10 per minute, but storyboards have multiple scenes)
    const estimatedWaitTime = Math.ceil(totalQueued * 0.5); // Rough estimate
    
    return {
      totalQueued,
      totalProcessing,
      totalCompleted,
      totalFailed,
      estimatedWaitTime,
    };
  },
});

// Clean up old completed/failed queue items (maintenance)
export const cleanupOldQueueItems = internalMutation({
  args: {
    olderThanHours: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, { olderThanHours = 24 }) => {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    const oldItems = await ctx.db
      .query("storyboardQueue")
      .filter((q) => 
        q.and(
          q.or(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("status"), "failed")
          ),
          q.lt(q.field("queuedAt"), cutoffTime)
        )
      )
      .collect();
    
    for (const item of oldItems) {
      await ctx.db.delete(item._id);
    }
    
    return oldItems.length;
  },
});

// Get all queue items for testing (internal use only)
export const getAllQueueItemsForTesting = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("storyboardQueue")
      .order("asc")
      .collect();
  },
});