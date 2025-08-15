import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
    const { imagePrompt, sceneNumber } = body;

    if (!imagePrompt || typeof imagePrompt !== "string") {
      return NextResponse.json(
        { error: "Invalid image prompt provided" },
        { status: 400 }
      );
    }

    if (imagePrompt.length < 50) {
      return NextResponse.json(
        { error: "Image prompt too short. Please provide a detailed prompt." },
        { status: 400 }
      );
    }

    // Generate image
    const imageResult = await generateImage(imagePrompt);
    const cost = estimateImageGenerationCost();

    return NextResponse.json({
      success: true,
      data: {
        imageData: imageResult.imageData,
        contentType: imageResult.contentType,
        size: imageResult.size,
        sceneNumber: sceneNumber || 1,
        cost: cost,
      },
    });
  } catch (error) {
    console.error("Error in generate-image API:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Handle specific error types
    if (message.includes("No image data")) {
      return NextResponse.json(
        { error: "No image was generated. Please try again with a different prompt." },
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
      { error: "Failed to generate image. Please try again." },
      { status: 500 }
    );
  }
}