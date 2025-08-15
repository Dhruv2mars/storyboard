import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateStory, estimateTextGenerationCost } from "@/lib/gemini-text-service";

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
    const { prompt } = body;

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

    // Estimate cost
    const estimatedInputTokens = prompt.length / 4; // Rough estimate
    const estimatedCost = estimateTextGenerationCost(estimatedInputTokens);

    // Generate story
    const storyResponse = await generateStory(prompt);

    return NextResponse.json({
      success: true,
      data: {
        title: storyResponse.title,
        scenes: storyResponse.scenes,
        estimatedCost: estimatedCost,
        sceneCount: storyResponse.scenes.length,
      },
    });
  } catch (error) {
    console.error("Error in generate-story API:", error);
    
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

    return NextResponse.json(
      { error: "Failed to generate story. Please try again." },
      { status: 500 }
    );
  }
}