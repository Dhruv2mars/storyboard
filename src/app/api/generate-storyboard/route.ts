import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateStory, estimateTextGenerationCost } from "@/lib/gemini-text-service";
import { generateImage, estimateImageGenerationCost } from "@/lib/gemini-image-service";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt, generateImages = true } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 }
      );
    }

    if (prompt.length < 10) {
      return NextResponse.json(
        { error: "Prompt too short. Please provide at least 10 characters." },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Prompt too long. Please keep it under 2000 characters." },
        { status: 400 }
      );
    }

    // Step 1: Generate story
    const storyResponse = await generateStory(prompt);
    
    // Estimate costs
    const estimatedInputTokens = prompt.length / 4;
    const textCost = estimateTextGenerationCost(estimatedInputTokens);
    const imageCost = generateImages ? estimateImageGenerationCost() * storyResponse.scenes.length : 0;
    const totalEstimatedCost = textCost + imageCost;

    interface SceneData {
  scene_number: number;
  scene_description: string;
  image_prompt: string;
  status: string;
  imageData?: string;
  contentType?: string;
  size?: number;
  error?: string;
}

// Prepare scenes with optional image generation
    const scenesWithImages: SceneData[] = [];
    let totalActualCost = textCost;

    for (const scene of storyResponse.scenes) {
      const sceneData: SceneData = {
        scene_number: scene.scene_number,
        scene_description: scene.scene_description,
        image_prompt: scene.image_prompt,
        status: generateImages ? "generating" : "text_only",
      };

      if (generateImages) {
        try {
          const imageResult = await generateImage(scene.image_prompt);
          sceneData.imageData = imageResult.imageData;
          sceneData.contentType = imageResult.contentType;
          sceneData.size = imageResult.size;
          sceneData.status = "completed";
          totalActualCost += estimateImageGenerationCost();
        } catch (imageError) {
          console.error(`Failed to generate image for scene ${scene.scene_number}:`, imageError);
          sceneData.status = "failed";
          sceneData.error = imageError instanceof Error ? imageError.message : "Unknown error";
        }
      }

      scenesWithImages.push(sceneData);
    }

    // Determine overall status
    const completedScenes = scenesWithImages.filter(s => s.status === "completed" || s.status === "text_only").length;
    const failedScenes = scenesWithImages.filter(s => s.status === "failed").length;
    
    let overallStatus: "completed" | "partial" | "failed";
    if (completedScenes === scenesWithImages.length) {
      overallStatus = "completed";
    } else if (completedScenes > 0) {
      overallStatus = "partial";
    } else {
      overallStatus = "failed";
    }

    return NextResponse.json({
      success: true,
      data: {
        title: storyResponse.title,
        scenes: scenesWithImages,
        status: overallStatus,
        costs: {
          estimated: totalEstimatedCost,
          actual: totalActualCost,
          text: textCost,
          images: totalActualCost - textCost,
        },
        statistics: {
          totalScenes: scenesWithImages.length,
          completedScenes,
          failedScenes,
          generateImages,
        },
      },
    });
  } catch (error) {
    console.error("Error in generate-storyboard API:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Handle specific error types
    if (message.includes("Invalid JSON response")) {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (message.includes("API key")) {
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    if (message.includes("rate limit") || message.includes("quota")) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate storyboard. Please try again." },
      { status: 500 }
    );
  }
}