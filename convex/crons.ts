import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process storyboard queue every 5 minutes (reduced from 30 seconds to save quota)
crons.interval(
  "process storyboard queue",
  { minutes: 5 },
  internal.storyboardProcessor.processStoryboard,
);

export default crons;