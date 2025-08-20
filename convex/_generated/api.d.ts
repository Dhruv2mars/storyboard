/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as apiKeyManager from "../apiKeyManager.js";
import type * as crons from "../crons.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as scenes from "../scenes.js";
import type * as storyboardProcessor from "../storyboardProcessor.js";
import type * as storyboardQueue from "../storyboardQueue.js";
import type * as storyboardWorkflow from "../storyboardWorkflow.js";
import type * as storyboards from "../storyboards.js";
import type * as userInit from "../userInit.js";
import type * as userRateLimiter from "../userRateLimiter.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  apiKeyManager: typeof apiKeyManager;
  crons: typeof crons;
  rateLimiter: typeof rateLimiter;
  scenes: typeof scenes;
  storyboardProcessor: typeof storyboardProcessor;
  storyboardQueue: typeof storyboardQueue;
  storyboardWorkflow: typeof storyboardWorkflow;
  storyboards: typeof storyboards;
  userInit: typeof userInit;
  userRateLimiter: typeof userRateLimiter;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
