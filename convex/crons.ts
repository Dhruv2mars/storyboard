import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process storyboard queue every 30 seconds
crons.interval(
  "process storyboard queue",
  { seconds: 30 },
  internal.storyboardProcessor.processStoryboard,
);

export default crons;