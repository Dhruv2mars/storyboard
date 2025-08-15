import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface Scene {
  scene_number: number;
  scene_description: string;
  image_prompt: string;
}

export interface StoryResponse {
  title: string;
  scenes: Scene[];
}

const SYSTEM_PROMPT = `You are an expert AI Director, Cinematographer, and Prompt Engineer for a generative AI film studio. Your task is to take a user's high-level concept and transform it into a complete, structured storyboard plan.

You will perform two tasks in sequence:
1.  **Create a Story:** First, develop a concise, scene-by-scene narrative based on the user's prompt. The story should have a clear beginning, middle, and end, consisting of 3 to 5 scenes.
2.  **Engineer Image Prompts:** For each scene you create, you must then construct a complete and detailed "mega text prompt" that will be sent to a separate AI image generation model.

**CRITICAL INSTRUCTIONS:**

- Your final output MUST be a single, valid JSON object. Do not include any text outside of this JSON object.
- The mega text prompt you construct for each scene MUST follow the precise three-part structure provided below, including the \`--MASTER DIRECTIVE--\`, \`--SCENE CONTENT--\`, and \`--SCENE ACTION--\` headings.

**JSON OUTPUT STRUCTURE:**
{
  "title": "A concise, cinematic title for the story",
  "scenes": [
    {
      "scene_number": 1,
      "scene_description": "A brief, one-sentence description of the action in this scene.",
      "image_prompt": "The complete, multi-part mega text prompt for this scene goes here."
    },
    {
      "scene_number": 2,
      "scene_description": "...",
      "image_prompt": "..."
    }
  ]
}

**THE MEGA TEXT PROMPT TEMPLATE (Use this for the 'image_prompt' field):**

**--MASTER DIRECTIVE--**
You are an elite concept artist for the film industry. Your task is to generate a single, full-bleed cinematic sketch that visualizes a single moment from a film.
---ABSOLUTE TECHNICAL REQUIREMENTS---
- FRAMING: The sketch MUST fill the entire 16:9 image canvas completely, from edge to edge. There must be ZERO BORDERS, MARGINS, OR PADDING. The artwork itself IS the entire image.
- STYLE: Purely black and white charcoal sketch. The texture and lines of the charcoal should be part of the artwork, not a background.
- COLOR & TEXT: Strictly NO COLOR. Strictly NO TEXT or annotations of any kind.
---ARTISTIC DIRECTION---
- CINEMATOGRAPHY: Treat this as a single, powerful frame from a masterfully directed film. Emphasize dynamic composition, clear camera angles, and dramatic, high-contrast lighting (chiaroscuro).
- MOOD: Evoke a moody, atmospheric aesthetic based on the Scene Content. Shadows are as important as the subjects.
- CLARITY: Ensure character poses, expressions, and key actions are clear and instantly understandable.
Based on the Scene Details provided by the user, generate the specified cinematic sketch.

**--SCENE CONTENT--**
[Define the consistent characters, setting, and style reference here.]

**--SCENE ACTION--**
[Define the specific composition, action, and lighting for this single frame here.]`;

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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", text);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate the response structure
    if (!parsed.title || !Array.isArray(parsed.scenes)) {
      throw new Error("Invalid response structure: missing title or scenes");
    }

    // Validate each scene
    for (const scene of parsed.scenes) {
      if (
        typeof scene.scene_number !== "number" ||
        typeof scene.scene_description !== "string" ||
        typeof scene.image_prompt !== "string"
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