"use client";

import { useState } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, Sparkles, Clock, DollarSign } from "lucide-react";
import Image from "next/image";

interface Scene {
  scene_number: number;
  scene_description: string;
  image_prompt: string;
  imageData?: string;
  contentType?: string;
  status?: "pending" | "generating" | "completed" | "failed";
}

interface StoryboardResult {
  title: string;
  scenes: Scene[];
  status: "completed" | "partial" | "failed";
  costs: {
    estimated: number;
    actual: number;
    text: number;
    images: number;
  };
  statistics: {
    totalScenes: number;
    completedScenes: number;
    failedScenes: number;
    generateImages: boolean;
  };
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const generateStoryboard = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setStoryboard(null);
    setProgress(0);
    setCurrentStep("Initializing...");

    try {
      setCurrentStep("Generating story...");
      setProgress(20);

      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          generateImages: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate storyboard");
      }

      setProgress(50);
      setCurrentStep("Generating images...");

      const data = await response.json();
      
      if (data.success) {
        setStoryboard(data.data);
        setProgress(90);
        setCurrentStep("Saving storyboard...");

        // Save storyboard to database
        try {
          const saveResponse = await fetch("/api/save-storyboard", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: data.data.title,
              originalPrompt: prompt.trim(),
              scenes: data.data.scenes,
              costs: data.data.costs,
              status: data.data.status,
            }),
          });

          if (saveResponse.ok) {
            setCurrentStep("Complete!");
          }
        } catch (saveError) {
          console.log("Save failed, but generation succeeded:", saveError);
          setCurrentStep("Complete! (Save failed)");
        }
        
        setProgress(100);
      } else {
        throw new Error("Generation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProgress(0);
      setCurrentStep("");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <SignedOut>
        <div className="text-center py-16">
          <div className="mb-8">
            <Film className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-4">AI Storyboard Generator</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform your ideas into professional cinematic storyboards with AI-generated 
              black and white sketches. Sign in to get started.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <Sparkles className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">AI-Powered</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Advanced AI models generate detailed scene descriptions and professional sketches
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Clock className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Fast Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get complete storyboards with 3-5 scenes in under a minute
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <DollarSign className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Affordable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Professional storyboards starting at just $0.12-0.20 per complete board
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Create Your Storyboard</h1>
            <p className="text-muted-foreground">
              Enter your story idea and watch it come to life
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Story Prompt</CardTitle>
              <CardDescription>
                Describe your story idea in a few sentences. Be creative!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Example: A detective investigates mysterious disappearances in a neon-lit cyberpunk city, discovering a conspiracy involving AI consciousness..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-32"
                disabled={isGenerating}
              />
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {prompt.length}/2000 characters
                </div>
                <Button 
                  onClick={generateStoryboard}
                  disabled={!prompt.trim() || isGenerating || prompt.length < 10}
                  className="min-w-32"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Storyboard
                    </>
                  )}
                </Button>
              </div>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{currentStep}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {storyboard && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">{storyboard.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {storyboard.statistics.totalScenes} scenes • 
                        Cost: ${storyboard.costs.actual.toFixed(3)}
                      </CardDescription>
                    </div>
                    <Badge variant={
                      storyboard.status === "completed" ? "default" :
                      storyboard.status === "partial" ? "secondary" : "destructive"
                    }>
                      {storyboard.status}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-6">
                {storyboard.scenes.map((scene) => (
                  <Card key={scene.scene_number}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">
                          Scene {scene.scene_number}
                        </CardTitle>
                        <Badge variant={
                          scene.status === "completed" ? "default" :
                          scene.status === "generating" ? "secondary" :
                          scene.status === "failed" ? "destructive" : "outline"
                        }>
                          {scene.status || "completed"}
                        </Badge>
                      </div>
                      <CardDescription>{scene.scene_description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Image Prompt</h4>
                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                              {scene.image_prompt.substring(0, 200)}...
                            </p>
                          </div>
                        </div>
                        <div>
                          {scene.imageData ? (
                            <div className="space-y-2">
                              <h4 className="font-medium">Generated Image</h4>
                              <Image
                                src={`data:${scene.contentType};base64,${scene.imageData}`}
                                alt={`Scene ${scene.scene_number}`}
                                width={640}
                                height={360}
                                className="w-full rounded border"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <h4 className="font-medium">Generated Image</h4>
                              <Skeleton className="w-full aspect-video rounded" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
