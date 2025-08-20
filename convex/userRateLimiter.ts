import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const USER_RATE_LIMIT_PER_MINUTE = 10;

// Check if user can process a request within their personal rate limits (BYOK)
export const canUserProcessRequest = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    
    const tracker = await ctx.db
      .query("userRateLimitTracker")
      .withIndex("by_user_and_minute", (q) => q.eq("userId", userId).eq("minute", currentMinute))
      .first();
    
    if (!tracker) {
      // No requests this minute yet
      return true;
    }
    
    return tracker.requestCount < USER_RATE_LIMIT_PER_MINUTE;
  },
});

// Increment the request count for the user's personal rate limit
export const incrementUserRequestCount = internalMutation({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    currentCount: v.number(),
    remainingRequests: v.number(),
    limitExceeded: v.boolean(),
  }),
  handler: async (ctx, { userId }) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    const now = Date.now();
    
    const existingTracker = await ctx.db
      .query("userRateLimitTracker")
      .withIndex("by_user_and_minute", (q) => q.eq("userId", userId).eq("minute", currentMinute))
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
        remainingRequests: Math.max(0, USER_RATE_LIMIT_PER_MINUTE - newCount),
        limitExceeded: newCount > USER_RATE_LIMIT_PER_MINUTE,
      };
    } else {
      // Create new tracker for this user and minute
      await ctx.db.insert("userRateLimitTracker", {
        userId,
        minute: currentMinute,
        requestCount: 1,
        lastUpdated: now,
      });
      
      return {
        currentCount: 1,
        remainingRequests: USER_RATE_LIMIT_PER_MINUTE - 1,
        limitExceeded: false,
      };
    }
  },
});

// Get current rate limit status for a user
export const getUserRateLimitStatus = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    currentCount: v.number(),
    limit: v.number(),
    remainingRequests: v.number(),
    resetTime: v.number(), // When the current minute window resets
    limitExceeded: v.boolean(),
  }),
  handler: async (ctx, { userId }) => {
    const currentMinute = Math.floor(Date.now() / 60000) * 60000;
    const resetTime = currentMinute + 60000; // Next minute
    
    const tracker = await ctx.db
      .query("userRateLimitTracker")
      .withIndex("by_user_and_minute", (q) => q.eq("userId", userId).eq("minute", currentMinute))
      .first();
    
    const currentCount = tracker ? tracker.requestCount : 0;
    
    return {
      currentCount,
      limit: USER_RATE_LIMIT_PER_MINUTE,
      remainingRequests: Math.max(0, USER_RATE_LIMIT_PER_MINUTE - currentCount),
      resetTime,
      limitExceeded: currentCount >= USER_RATE_LIMIT_PER_MINUTE,
    };
  },
});

// Clean up old user rate limit trackers (older than 2 hours)
export const cleanupOldUserTrackers = internalMutation({
  args: {
    userId: v.optional(v.string()), // If provided, clean only for this user
  },
  returns: v.number(),
  handler: async (ctx, { userId }) => {
    const twoHoursAgo = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 60000) * 60000;
    
    let oldTrackers;
    if (userId) {
      // Clean for specific user
      oldTrackers = await ctx.db
        .query("userRateLimitTracker")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.lt(q.field("minute"), twoHoursAgo))
        .collect();
    } else {
      // Clean for all users
      oldTrackers = await ctx.db
        .query("userRateLimitTracker")
        .filter((q) => q.lt(q.field("minute"), twoHoursAgo))
        .collect();
    }
    
    for (const tracker of oldTrackers) {
      await ctx.db.delete(tracker._id);
    }
    
    return oldTrackers.length;
  },
});

// Get rate limit statistics for a user (for monitoring/debugging)
export const getUserRateLimitStats = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    currentMinuteCount: v.number(),
    lastHourTotal: v.number(),
    peakRequestsInMinute: v.number(),
  }),
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;
    const oneHourAgo = currentMinute - 60 * 60 * 1000;
    
    // Get all trackers from the last hour for this user
    const recentTrackers = await ctx.db
      .query("userRateLimitTracker")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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