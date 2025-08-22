import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

const MAX_RETRIES = 3;

// Master directive constant for image generation
const MASTER_DIRECTIVE = `--MASTER DIRECTIVE--
You are an elite concept artist for the film industry. Your task is to generate a single, full-bleed cinematic sketch that visualizes a single moment from a film.
---ABSOLUTE TECHNICAL REQUIREMENTS---
- FRAMING: The sketch MUST fill the entire 16:9 image canvas completely, from edge to edge. There must be ZERO BORDERS, MARGINS, OR PADDING. The artwork itself IS the entire image.
- STYLE: Purely black and white charcoal sketch. The texture and lines of the charcoal should be part of the artwork, not a background.
- COLOR & TEXT: Strictly NO COLOR. Strictly NO TEXT or annotations of any kind.
---ARTISTIC DIRECTION---
- CINEMATOGRAPHY: Treat this as a single, powerful frame from a masterfully directed film. Emphasize dynamic composition, clear camera angles, and dramatic, high-contrast lighting (chiaroscuro).
- MOOD: Evoke a moody, atmospheric aesthetic based on the Scene Content. Shadows are as important as the subjects.
- CLARITY: Ensure character poses, expressions, and key actions are clear and instantly understandable.
Based on the Scene Details provided by the user, generate the specified cinematic sketch.`;

// Process a single storyboard from the queue
export const processStoryboard = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Checking for storyboards to process...");
    
    // Get next storyboard from queue
    const queueItem = await ctx.runQuery(internal.storyboardQueue.getNextQueueItem);
    if (!queueItem) {
      console.log("No storyboards in queue - cron will check again later");
      return;
    }
    
    console.log(`Processing storyboard ${queueItem.storyboardId} for user ${queueItem.userId}`);
    
    // Mark as processing
    await ctx.runMutation(internal.storyboardQueue.updateQueueItemStatus, {
      queueItemId: queueItem._id,
      status: "processing",
      startedAt: Date.now(),
    });
    
    try {
      // Get storyboard details
      const storyboard = await ctx.runQuery(internal.storyboards.getStoryboardInternal, {
        id: queueItem.storyboardId,
      });
      
      if (!storyboard) {
        throw new Error("Storyboard not found");
      }
      
      // Get all scenes for this storyboard
      const scenes = await ctx.runQuery(internal.scenes.getStoryboardScenesInternal, {
        storyboardId: queueItem.storyboardId,
      });
      
      console.log(`Processing ${scenes.length} scenes for storyboard ${storyboard.title}`);
      
      // Initialize Gemini client
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      let completedScenes = 0;
      let totalCost = 0.025; // Base text generation cost
      
      // Process each scene with rate limiting
      for (const scene of scenes) {
        console.log(`Processing scene ${scene.sceneNumber}...`);
        
        // Check rate limit before each request
        const canProcess = await ctx.runQuery(internal.rateLimiter.canProcessRequest);
        if (!canProcess) {
          console.log("Rate limit reached, waiting...");
          // Wait 6 seconds and check again
          await new Promise(resolve => setTimeout(resolve, 6000));
          const stillCanProcess = await ctx.runQuery(internal.rateLimiter.canProcessRequest);
          if (!stillCanProcess) {
            throw new Error("Rate limit still exceeded after waiting");
          }
        }
        
        // Update scene status to generating
        await ctx.runMutation(internal.scenes.updateSceneStatus, {
          sceneId: scene._id,
          status: "generating",
        });
        
        // Increment rate limit counter
        await ctx.runMutation(internal.rateLimiter.incrementRequestCount);
        
        // Assemble the mega prompt
        const megaPrompt = `${MASTER_DIRECTIVE}\\n\\n${storyboard.storyAnchorContent}\\n\\n${scene.sceneAction}`;
        
        // Generate image
        console.log(`Generating image for scene ${scene.sceneNumber} with prompt length: ${megaPrompt.length}`);
        
        let imageResult;
        try {
          imageResult = await genAI.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: [{ role: "user", parts: [{ text: megaPrompt }] }],
            config: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          });
        } catch (apiError) {
          console.error(`Gemini API error for scene ${scene.sceneNumber}:`, apiError);
          throw new Error(`Image generation API failed for scene ${scene.sceneNumber}: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
        }
        
        console.log(`Image generation response structure:`, {
          candidatesLength: imageResult.candidates?.length || 0,
          firstCandidate: imageResult.candidates?.[0] ? {
            hasContent: !!imageResult.candidates[0].content,
            partsLength: imageResult.candidates[0].content?.parts?.length || 0
          } : null
        });
        
        // Extract image data
        let imageData: string | undefined;
        let mimeType = "image/png";
        
        const parts = imageResult.candidates?.[0]?.content?.parts || [];
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          console.log(`Part ${i}:`, {
            hasInlineData: !!part.inlineData,
            hasData: !!part.inlineData?.data,
            mimeType: part.inlineData?.mimeType,
            hasText: !!part.text,
            textLength: part.text?.length || 0
          });
          
          if (part.inlineData?.data) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType || "image/png";
            console.log(`Found image data in part ${i}, size: ${imageData.length} chars`);
            break;
          }
        }
        
        if (!imageData) {
          console.error(`No image data found for scene ${scene.sceneNumber}. Response:`, JSON.stringify(imageResult, null, 2));
          throw new Error(`No image data received for scene ${scene.sceneNumber}. API response did not contain inline image data.`);
        }

        // Store image in Convex File Storage
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const storageId = await ctx.storage.store(blob);
        
        // Calculate cost (3.9 cents per image)
        const imageCost = 0.039;
        totalCost += imageCost;

        // Update scene with image and complete prompt
        await ctx.runMutation(internal.scenes.updateSceneImage, {
          sceneId: scene._id,
          imageStorageId: storageId,
          imageContentType: mimeType,
          imagePrompt: megaPrompt,
        });

        // Update scene cost and mark as completed
        await ctx.runMutation(internal.scenes.updateSceneCost, {
          sceneId: scene._id,
          cost: imageCost,
        });
        
        await ctx.runMutation(internal.scenes.updateSceneStatus, {
          sceneId: scene._id,
          status: "completed",
        });
        
        completedScenes++;
        console.log(`Scene ${scene.sceneNumber} completed successfully`);
        
        // Wait 6 seconds between requests to respect rate limit
        if (completedScenes < scenes.length) {
          await new Promise(resolve => setTimeout(resolve, 6000));
        }
      }
      
      // Update storyboard as completed
      await ctx.runMutation(internal.storyboards.updateStoryboard, {
        id: queueItem.storyboardId,
        status: "completed",
        completedScenes: completedScenes,
        estimatedCost: totalCost,
        actualCost: totalCost,
        textCost: 0.025,
        imagesCost: totalCost - 0.025,
      });
      
      // Mark queue item as completed
      await ctx.runMutation(internal.storyboardQueue.updateQueueItemStatus, {
        queueItemId: queueItem._id,
        status: "completed",
        completedAt: Date.now(),
      });
      
      console.log(`Storyboard ${storyboard.title} completed successfully. Total cost: $${totalCost.toFixed(3)}`);
      
    } catch (error) {
      console.error(`Error processing storyboard ${queueItem.storyboardId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if we should retry
      if (queueItem.retryCount < MAX_RETRIES) {
        console.log(`Retrying storyboard ${queueItem.storyboardId} (attempt ${queueItem.retryCount + 1}/${MAX_RETRIES})`);
        
        // Increment retry count and reset to queued
        await ctx.runMutation(internal.storyboardQueue.incrementRetryCount, {
          queueItemId: queueItem._id,
        });
        
        // Reset storyboard status
        await ctx.runMutation(internal.storyboards.updateStoryboard, {
          id: queueItem.storyboardId,
          status: "generating",
          completedScenes: 0,
        });
        
        // Reset all scene statuses
        const scenes = await ctx.runQuery(internal.scenes.getStoryboardScenesInternal, {
          storyboardId: queueItem.storyboardId,
        });
        
        for (const scene of scenes) {
          await ctx.runMutation(internal.scenes.updateSceneStatus, {
            sceneId: scene._id,
            status: "pending",
          });
        }
      } else {
        console.log(`Max retries reached for storyboard ${queueItem.storyboardId}, marking as failed`);
        
        // Mark queue item as failed
        await ctx.runMutation(internal.storyboardQueue.updateQueueItemStatus, {
          queueItemId: queueItem._id,
          status: "failed",
          error: errorMessage,
          completedAt: Date.now(),
        });
        
        // Mark storyboard as failed
        await ctx.runMutation(internal.storyboards.updateStoryboard, {
          id: queueItem.storyboardId,
          status: "failed",
        });
      }
    }
    
    // Cron job will handle scheduling - no need for recursive scheduling
  },
});

// Process storyboard immediately with user's own API key (BYOK)
export const processStoryboardWithUserKey = internalAction({
  args: {
    storyboardId: v.id("storyboards"),
    userId: v.string(),
  },
  handler: async (ctx, { storyboardId, userId }) => {
    console.log(`Processing storyboard ${storyboardId} with user ${userId}'s API key (BYOK)`);
    
    try {
      // Get user's API key
      const userApiKey = await ctx.runQuery(internal.apiKeyManager.getUserApiKeyInternal, { userId });
      
      if (!userApiKey) {
        throw new Error("User API key not found - BYOK should be disabled");
      }

      // Get storyboard details
      const storyboard = await ctx.runQuery(internal.storyboards.getStoryboardInternal, {
        id: storyboardId,
      });
      
      if (!storyboard) {
        throw new Error("Storyboard not found");
      }
      
      // Get all scenes for this storyboard
      const scenes = await ctx.runQuery(internal.scenes.getStoryboardScenesInternal, {
        storyboardId: storyboardId,
      });
      
      console.log(`Processing ${scenes.length} scenes for storyboard ${storyboard.title} with user's API key`);
      
      // Initialize Gemini client with user's API key
      const genAI = new GoogleGenAI({ apiKey: userApiKey });
      
      let completedScenes = 0;
      let totalCost = 0.025; // Base text generation cost
      let rateLimitExceeded = false;
      
      // Process each scene with user's rate limiting
      for (const scene of scenes) {
        console.log(`Processing scene ${scene.sceneNumber} with user's key...`);
        
        // Check user's personal rate limit
        const canProcess = await ctx.runQuery(internal.userRateLimiter.canUserProcessRequest, { userId });
        if (!canProcess) {
          console.log(`User ${userId} rate limit reached - cannot process more scenes`);
          rateLimitExceeded = true;
          break;
        }
        
        // Update scene status to generating
        await ctx.runMutation(internal.scenes.updateSceneStatus, {
          sceneId: scene._id,
          status: "generating",
        });
        
        // Increment user's rate limit counter
        const rateLimitResult = await ctx.runMutation(internal.userRateLimiter.incrementUserRequestCount, { userId });
        console.log(`User rate limit: ${rateLimitResult.currentCount}/10, exceeded: ${rateLimitResult.limitExceeded}`);
        
        // Assemble the mega prompt
        const megaPrompt = `${MASTER_DIRECTIVE}\\n\\n${storyboard.storyAnchorContent}\\n\\n${scene.sceneAction}`;
        
        // Generate image with user's API key
        console.log(`Generating image for scene ${scene.sceneNumber} with user's API key, prompt length: ${megaPrompt.length}`);
        
        let imageResult;
        try {
          imageResult = await genAI.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: [{ role: "user", parts: [{ text: megaPrompt }] }],
            config: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          });
        } catch (apiError) {
          console.error(`BYOK Gemini API error for scene ${scene.sceneNumber}:`, apiError);
          throw new Error(`BYOK Image generation API failed for scene ${scene.sceneNumber}: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
        }
        
        console.log(`BYOK Image generation response structure:`, {
          candidatesLength: imageResult.candidates?.length || 0,
          firstCandidate: imageResult.candidates?.[0] ? {
            hasContent: !!imageResult.candidates[0].content,
            partsLength: imageResult.candidates[0].content?.parts?.length || 0
          } : null
        });
        
        // Extract image data
        let imageData: string | undefined;
        let mimeType = "image/png";
        
        const parts = imageResult.candidates?.[0]?.content?.parts || [];
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          console.log(`BYOK Part ${i}:`, {
            hasInlineData: !!part.inlineData,
            hasData: !!part.inlineData?.data,
            mimeType: part.inlineData?.mimeType,
            hasText: !!part.text,
            textLength: part.text?.length || 0
          });
          
          if (part.inlineData?.data) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType || "image/png";
            console.log(`BYOK Found image data in part ${i}, size: ${imageData.length} chars`);
            break;
          }
        }
        
        if (!imageData) {
          console.error(`BYOK No image data found for scene ${scene.sceneNumber}. Response:`, JSON.stringify(imageResult, null, 2));
          throw new Error(`No image data received for scene ${scene.sceneNumber}. API response did not contain inline image data.`);
        }

        // Store image in Convex File Storage
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const storageId = await ctx.storage.store(blob);
        
        // Calculate cost (3.9 cents per image)
        const imageCost = 0.039;
        totalCost += imageCost;

        // Update scene with image and complete prompt
        await ctx.runMutation(internal.scenes.updateSceneImage, {
          sceneId: scene._id,
          imageStorageId: storageId,
          imageContentType: mimeType,
          imagePrompt: megaPrompt,
        });

        // Update scene cost and mark as completed
        await ctx.runMutation(internal.scenes.updateSceneCost, {
          sceneId: scene._id,
          cost: imageCost,
        });
        
        await ctx.runMutation(internal.scenes.updateSceneStatus, {
          sceneId: scene._id,
          status: "completed",
        });
        
        completedScenes++;
        console.log(`Scene ${scene.sceneNumber} completed successfully with user's API key`);
        
        // Wait 6 seconds between requests to respect user's rate limit
        if (completedScenes < scenes.length && !rateLimitExceeded) {
          await new Promise(resolve => setTimeout(resolve, 6000));
        }
      }
      
      // Determine final status
      let finalStatus: "completed" | "partial" | "failed" = "completed";
      if (rateLimitExceeded && completedScenes < scenes.length) {
        finalStatus = completedScenes > 0 ? "partial" : "failed";
        console.log(`User ${userId} hit rate limit - storyboard marked as ${finalStatus} (${completedScenes}/${scenes.length} scenes)`);
      } else if (completedScenes < scenes.length) {
        finalStatus = "partial";
      }
      
      // Update storyboard status
      await ctx.runMutation(internal.storyboards.updateStoryboard, {
        id: storyboardId,
        status: finalStatus,
        completedScenes: completedScenes,
        estimatedCost: totalCost,
        actualCost: totalCost,
        textCost: 0.025,
        imagesCost: totalCost - 0.025,
      });
      
      console.log(`BYOK storyboard ${storyboard.title} completed: ${finalStatus}. Total cost: $${totalCost.toFixed(3)} (user's API key)`);
      
      // If rate limit exceeded, return info for frontend notification
      if (rateLimitExceeded) {
        // Could store this info for frontend to display
        console.log(`RATE LIMIT NOTIFICATION: User ${userId} exceeded their API rate limit (10 RPM)`);
      }
      
    } catch (error) {
      console.error(`Error processing BYOK storyboard ${storyboardId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a rate limit error
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        console.log(`User ${userId} API key hit rate limit: ${errorMessage}`);
        
        // Mark storyboard as partial/failed due to rate limit
        await ctx.runMutation(internal.storyboards.updateStoryboard, {
          id: storyboardId,
          status: "failed",
        });
        
        // Could notify frontend about rate limit here
      } else {
        // Mark storyboard as failed
        await ctx.runMutation(internal.storyboards.updateStoryboard, {
          id: storyboardId,
          status: "failed",
        });
      }
      
      throw error;
    }
  },
});

// Start the storyboard processor (deprecated - now handled by cron job)
export const startProcessor = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Processor startup called - now handled by cron job");
    // No longer schedules recursive processing - cron job handles it
  },
});