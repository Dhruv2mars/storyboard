import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Scene {
  scene_number: number;
  scene_description: string;
  scene_action: string;
}

export interface StoryResponse {
  title: string;
  logline: string;
  story_anchor_content: string;
  scenes: Scene[];
}

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

export async function generateStory(userPrompt: string): Promise<StoryResponse> {
  try {
    const prompt = `${SYSTEM_PROMPT}\n\nUSER PROMPT: ${userPrompt}`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt
    });
    
    const text = result.text;

    // Parse the JSON response
    let parsed: StoryResponse;
    try {
      // Extract JSON from response if there's any extra text
      const jsonMatch = text?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", text);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate the response structure
    if (!parsed.title || !parsed.logline || !parsed.story_anchor_content || !Array.isArray(parsed.scenes)) {
      throw new Error("Invalid response structure: missing required fields");
    }

    // Validate each scene
    for (const scene of parsed.scenes) {
      if (
        typeof scene.scene_number !== "number" ||
        typeof scene.scene_description !== "string" ||
        typeof scene.scene_action !== "string"
      ) {
        throw new Error("Invalid scene structure");
      }
    }

    return parsed;
  } catch (error) {
    console.error("Error generating story:", error);
    throw error;
  }
}

export function estimateTextGenerationCost(inputTokens: number): number {
  // Gemini 2.0 Flash Lite pricing (example rates)
  // Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
  const inputCostPer1M = 0.075;
  const outputCostPer1M = 0.30;
  const estimatedOutputTokens = inputTokens * 2; // Rough estimate
  
  return ((inputTokens * inputCostPer1M) + (estimatedOutputTokens * outputCostPer1M)) / 1000000;
}