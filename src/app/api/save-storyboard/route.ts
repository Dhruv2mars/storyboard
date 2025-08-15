import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      title, 
      originalPrompt, 
      scenes, 
      costs,
      status = "completed" 
    } = body;

    // First ensure user exists in Convex
    let convexUser = await convex.query(api.users.getUserByClerkId, {
      clerkId: userId,
    });

    if (!convexUser) {
      // Create user if doesn't exist
      const userEmail = request.headers.get("clerk-user-email") || "user@example.com";
      const userName = request.headers.get("clerk-user-name") || "User";
      
      const convexUserId = await convex.mutation(api.users.createUser, {
        clerkId: userId,
        email: userEmail,
        name: userName,
      });

      convexUser = { _id: convexUserId };
    }

    // Create storyboard
    const storyboardId = await convex.mutation(api.storyboards.createStoryboard, {
      userId: convexUser._id,
      title,
      originalPrompt,
      sceneCount: scenes.length,
      estimatedCost: costs?.estimated || 0,
      actualCost: costs?.actual || 0,
    });

    // Update storyboard status
    await convex.mutation(api.storyboards.updateStoryboardStatus, {
      storyboardId,
      status,
      actualCost: costs?.actual,
    });

    // Save scenes
    for (const scene of scenes) {
      await convex.mutation(api.scenes.createScene, {
        storyboardId,
        sceneNumber: scene.scene_number,
        description: scene.scene_description,
        imagePrompt: scene.image_prompt,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        storyboardId,
        message: "Storyboard saved successfully",
      },
    });

  } catch (error) {
    console.error("Error saving storyboard:", error);
    return NextResponse.json(
      { error: "Failed to save storyboard" },
      { status: 500 }
    );
  }
}