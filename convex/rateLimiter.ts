import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const RATE_LIMIT_PER_MINUTE = 10;

// Check if we can process a request within rate limits
export const canProcessRequest = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    
    const tracker = await ctx.db
      .query("rateLimitTracker")
      .withIndex("by_minute", (q) => q.eq("minute", currentMinute))
      .first();
    
    if (!tracker) {
      // No requests this minute yet
      return true;
    }
    
    return tracker.requestCount < RATE_LIMIT_PER_MINUTE;
  },
});

// Increment the request count for the current minute
export const incrementRequestCount = internalMutation({
  args: {},
  returns: v.object({
    currentCount: v.number(),
    remainingRequests: v.number(),
  }),
  handler: async (ctx) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    const now = Date.now();
    
    const existingTracker = await ctx.db
      .query("rateLimitTracker")
      .withIndex("by_minute", (q) => q.eq("minute", currentMinute))
      .first();
    
    if (existingTracker) {
      // Update existing tracker
      const newCount = existingTracker.requestCount + 1;
      await ctx.db.patch(existingTracker._id, {
        requestCount: newCount,
        lastUpdated: now,
      });
      
      return {
        currentCount: newCount,
        remainingRequests: Math.max(0, RATE_LIMIT_PER_MINUTE - newCount),
      };
    } else {
      // Create new tracker for this minute
      await ctx.db.insert("rateLimitTracker", {
        minute: currentMinute,
        requestCount: 1,
        lastUpdated: now,
      });
      
      return {
        currentCount: 1,
        remainingRequests: RATE_LIMIT_PER_MINUTE - 1,
      };
    }
  },
});

// Get current rate limit status
export const getRateLimitStatus = internalQuery({
  args: {},
  returns: v.object({
    currentCount: v.number(),
    limit: v.number(),
    remainingRequests: v.number(),
    resetTime: v.number(), // When the current minute window resets
  }),
  handler: async (ctx) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    const resetTime = currentMinute + 60000; // Next minute
    
    const tracker = await ctx.db
      .query("rateLimitTracker")
      .withIndex("by_minute", (q) => q.eq("minute", currentMinute))
      .first();
    
    const currentCount = tracker ? tracker.requestCount : 0;
    
    return {
      currentCount,
      limit: RATE_LIMIT_PER_MINUTE,
      remainingRequests: Math.max(0, RATE_LIMIT_PER_MINUTE - currentCount),
      resetTime,
    };
  },
});

// Clean up old rate limit trackers (older than 2 hours)
export const cleanupOldTrackers = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const twoHoursAgo = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 60000) * 60000;
    
    const oldTrackers = await ctx.db
      .query("rateLimitTracker")
      .filter((q) => q.lt(q.field("minute"), twoHoursAgo))
      .collect();
    
    for (const tracker of oldTrackers) {
      await ctx.db.delete(tracker._id);
    }
    
    return oldTrackers.length;
  },
});

// Get rate limit statistics for monitoring
export const getRateLimitStats = internalQuery({
  args: {},
  returns: v.object({
    currentMinuteCount: v.number(),
    lastHourTotal: v.number(),
    peakRequestsInMinute: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;
    const oneHourAgo = currentMinute - 60 * 60 * 1000;
    
    // Get all trackers from the last hour
    const recentTrackers = await ctx.db
      .query("rateLimitTracker")
      .filter((q) => q.gte(q.field("minute"), oneHourAgo))
      .collect();
    
    const currentMinuteTracker = recentTrackers.find(t => t.minute === currentMinute);
    const currentMinuteCount = currentMinuteTracker ? currentMinuteTracker.requestCount : 0;
    
    const lastHourTotal = recentTrackers.reduce((sum, tracker) => sum + tracker.requestCount, 0);
    const peakRequestsInMinute = recentTrackers.length > 0 
      ? Math.max(...recentTrackers.map(t => t.requestCount))
      : 0;
    
    return {
      currentMinuteCount,
      lastHourTotal,
      peakRequestsInMinute,
    };
  },
});