import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

// System prompt for LLM
const SYSTEM_PROMPT = `You are an expert AI Director and Cinematographer. Your task is to take a user's high-level concept and transform it into a structured storyboard plan.

Your workflow is:
1.  Define the consistent "story anchor content" (characters, setting, style).
2.  Create a 3-5 scene narrative, writing a unique "scene action" for each scene.

Your final output MUST be a single, valid JSON object following the structure below. Do not include any other text or explanations.

**JSON OUTPUT STRUCTURE:**
{
  "title": "A concise, cinematic title for the story",
  "logline": "A one-sentence summary of the story arc.",
  "story_anchor_content": "A complete text block starting with '--SCENE CONTENT--' that defines the consistent characters, setting, and style reference for the entire story.",
  "scenes": [
    {
      "scene_number": 1,
      "scene_description": "A brief, one-sentence description of the action in this scene.",
      "scene_action": "A complete text block starting with '--SCENE ACTION--' that describes the specific composition, action, and lighting for this single frame."
    }
  ]
}`;

interface Scene {
  scene_number: number;
  scene_description: string;
  scene_action: string;
}

interface StoryResponse {
  title: string;
  logline: string;
  story_anchor_content: string;
  scenes: Scene[];
}

// Phase 1: Generate story structure and create storyboard record
export const generateStoryStructure = action({
  args: {
    prompt: v.string(),
    userId: v.string(),
  },
  returns: v.object({
    storyboardId: v.string(),
    title: v.string(),
    logline: v.string(),
    storyAnchorContent: v.string(),
    totalScenes: v.number(),
  }),
  handler: async (ctx, { prompt, userId }): Promise<{
    storyboardId: string;
    title: string;
    logline: string;
    storyAnchorContent: string;
    totalScenes: number;
  }> => {
    console.log("Generating story structure for user:", userId);
    
    try {
      // Initialize Gemini client
      console.log("API Key available:", !!process.env.GEMINI_API_KEY);
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Generate story structure with LLM
      const fullPrompt = `${SYSTEM_PROMPT}\n\nUSER PROMPT: ${prompt}`;
      
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: fullPrompt
      });
      
      const text = result.text;
      
      // Parse the JSON response
      let storyData: StoryResponse;
      try {
        const jsonMatch = text?.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON found in response");
        }
        
        storyData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Failed to parse JSON response:", text);
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validate the response structure
      if (!storyData.title || !storyData.logline || !storyData.story_anchor_content || !Array.isArray(storyData.scenes)) {
        throw new Error("Invalid response structure: missing required fields");
      }

      console.log(`Story generated: ${storyData.title} with ${storyData.scenes.length} scenes`);

      // Create storyboard record
      const storyboardId: any = await ctx.runMutation(internal.storyboards.createStoryboard, {
        userId,
        title: storyData.title,
        logline: storyData.logline,
        originalPrompt: prompt,
        storyAnchorContent: storyData.story_anchor_content,
        status: "generating" as const,
        totalScenes: storyData.scenes.length,
      });

      // Create pending scene records
      for (const scene of storyData.scenes) {
        await ctx.runMutation(internal.scenes.createScene, {
          storyboardId,
          sceneNumber: scene.scene_number,
          sceneDescription: scene.scene_description,
          sceneAction: scene.scene_action,
          imageStorageId: undefined,
          imageContentType: undefined,
          status: "pending" as const,
          cost: 0,
        });
      }

      // Check if user has BYOK enabled
      const useBYOK = await ctx.runQuery(internal.apiKeyManager.shouldUseBYOK, { userId });
      
      if (useBYOK) {
        console.log(`User ${userId} using BYOK - processing immediately`);
        // Process immediately with user's own API key
        await ctx.runAction(internal.storyboardProcessor.processStoryboardWithUserKey, {
          storyboardId,
          userId,
        });
      } else {
        console.log(`User ${userId} using shared key - adding to queue`);
        // Add storyboard to queue for processing with shared API key
        await ctx.runMutation(internal.storyboardQueue.addToQueue, {
          storyboardId,
          userId,
        });
      }

      return {
        storyboardId: storyboardId as string,
        title: storyData.title,
        logline: storyData.logline,
        storyAnchorContent: storyData.story_anchor_content,
        totalScenes: storyData.scenes.length,
      };
      
    } catch (error) {
      console.error("Error in story generation:", error);
      throw new Error(`Story generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Note: Image generation is now handled by the queue processor
// See convex/queueProcessor.ts for the actual image generation logic

// Phase 3: Check if storyboard is complete and update final status
export const checkStoryboardCompletion = internalAction({
  args: {
    storyboardId: v.id("storyboards"),
  },
  handler: async (ctx, { storyboardId }) => {
    try {
      // Get all scenes for this storyboard
      const scenes = await ctx.runQuery(internal.scenes.getStoryboardScenesInternal, { storyboardId });
      
      const totalScenes = scenes.length;
      const completedScenes = scenes.filter((s: any) => s.status === "completed").length;
      const failedScenes = scenes.filter((s: any) => s.status === "failed").length;
      const pendingScenes = scenes.filter((s: any) => s.status === "pending" || s.status === "generating").length;

      // Only update if all scenes are done (no pending/generating)
      if (pendingScenes === 0) {
        const finalStatus = completedScenes === totalScenes ? "completed" : 
                           completedScenes > 0 ? "partial" : "failed";

        // Calculate costs
        const totalImageCost = scenes.reduce((sum: number, scene: any) => sum + (scene.cost || 0), 0);
        const estimatedTextCost = 0.025; // Rough estimate
        const totalCost = estimatedTextCost + totalImageCost;

        await ctx.runMutation(internal.storyboards.updateStoryboard, {
          id: storyboardId,
          status: finalStatus,
          completedScenes: completedScenes,
          estimatedCost: totalCost,
          actualCost: totalCost,
          textCost: estimatedTextCost,
          imagesCost: totalImageCost,
        });

        console.log(`Storyboard ${storyboardId} completed. Status: ${finalStatus}, Cost: $${totalCost.toFixed(3)}`);
      }
    } catch (error) {
      console.error("Error checking storyboard completion:", error);
    }
  },
});