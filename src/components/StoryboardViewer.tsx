"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Film } from "lucide-react";

interface StoryboardViewerProps {
  storyboardId: string;
}

// Component for displaying a scene image
function SceneImage({ scene }: { scene: { imageStorageId?: string; status: string; sceneNumber: number } }) {
  const imageUrl = useQuery(api.scenes.getImageUrl, 
    scene.imageStorageId ? { storageId: scene.imageStorageId as Id<"_storage"> } : "skip"
  );

  if (!scene.imageStorageId) {
    if (scene.status === "failed") {
      return (
        <div className="w-full aspect-[16/10] border border-dashed border-muted bg-muted/30 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Generation failed</p>
        </div>
      );
    }
    return <Skeleton className="w-full aspect-[16/10]" />;
  }

  if (!imageUrl) {
    return <Skeleton className="w-full aspect-[16/10]" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={`Scene ${scene.sceneNumber}`}
      className="w-full aspect-[16/10] object-cover bg-muted"
    />
  );
}

export function StoryboardViewer({ storyboardId }: StoryboardViewerProps) {
  const { user } = useUser();
  
  const storyboards = useQuery(
    api.storyboards.getUserStoryboards,
    user?.id ? { userId: user.id } : "skip"
  );

  const scenes = useQuery(
    api.scenes.getStoryboardScenes,
    storyboardId ? { storyboardId: storyboardId as never } : "skip"
  );

  const queueStatus = useQuery(
    api.storyboardQueue.getStoryboardQueueStatus,
    storyboardId ? { storyboardId: storyboardId as never } : "skip"
  );

  // Find the specific storyboard
  const currentStoryboard = storyboards?.find(sb => sb._id === storyboardId);


  if (!currentStoryboard) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="w-full aspect-video rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completedScenes = scenes?.filter(s => s.status === "completed").length || 0;
  const totalScenes = currentStoryboard.totalScenes || currentStoryboard.sceneCount || 0;
  const progressPercent = totalScenes > 0 
    ? (completedScenes / totalScenes) * 100 
    : 0;

  return (
    <div className="p-4 sm:p-6 w-full max-w-none">
      {/* Header */}
      <div className="mb-8 max-w-4xl mx-auto">
        {currentStoryboard.logline && (
          <p className="text-muted-foreground mb-6 text-lg leading-relaxed">{currentStoryboard.logline}</p>
        )}

        {/* Progress */}
        {currentStoryboard.status === "generating" && (
          <div className="bg-muted/30 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium">Generating storyboard...</span>
              <span className="text-xs text-muted-foreground">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="h-2 bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Queue Status */}
        {queueStatus && queueStatus.status === "queued" && (
          <div className="bg-muted/30 border rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Position #{queueStatus.position || "Calculating..."} in queue
            </p>
          </div>
        )}
      </div>

      {/* Scenes - Grid Layout */}
      {scenes && scenes.length > 0 ? (
        <div className="pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 auto-rows-fr">
            {scenes.map((scene) => (
              <Card key={scene.sceneNumber} className="overflow-hidden h-full flex flex-col">
                <CardContent className="p-0 flex-1 flex flex-col">
                  <div className="relative flex-1">
                    <SceneImage scene={scene} />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 sm:p-4">
                      <h3 className="text-white font-semibold text-base sm:text-lg mb-1">
                        Scene {scene.sceneNumber}
                      </h3>
                      <p className="text-white/90 text-xs sm:text-sm leading-relaxed line-clamp-3 overflow-hidden">
                        {scene.sceneDescription || scene.description || "Scene description"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Film className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Scenes will appear here as they are generated</p>
        </div>
      )}
    </div>
  );
}