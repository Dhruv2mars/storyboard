"use client";

import { useState, KeyboardEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Film, Sparkles, AlertCircle } from "lucide-react";

interface StoryCreatorProps {
  onStoryCreated?: (storyboardId: string) => void;
}

interface StoryCreationResult {
  storyboardId: string;
  title: string;
  logline: string;
  totalScenes: number;
}

export function StoryCreator({ onStoryCreated }: StoryCreatorProps) {
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [creationResult, setCreationResult] = useState<StoryCreationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  // Convex hooks
  const generateStoryStructure = useAction(api.storyboardWorkflow.generateStoryStructure);
  

  const handleGenerateStoryboard = async () => {
    if (!prompt.trim() || !user?.id) return;
    
    setIsGenerating(true);
    setError(null);
    setCreationResult(null);
    setProgress(0);
    setCurrentStep("Creating your story...");

    try {
      // Generate story structure
      const result = await generateStoryStructure({
        prompt: prompt.trim(),
        userId: user.id,
      });

      setProgress(100);
      setCurrentStep("Story created successfully!");
      setCreationResult({
        storyboardId: result.storyboardId,
        title: result.title,
        logline: result.logline,
        totalScenes: result.totalScenes,
      });

      // Notify parent component
      onStoryCreated?.(result.storyboardId);
      
      // Clear form
      setPrompt("");
      setIsGenerating(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProgress(0);
      setCurrentStep("");
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setPrompt("");
    setCreationResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating && prompt.length >= 20) {
        handleGenerateStoryboard();
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Create New Storyboard</h1>
        <p className="text-muted-foreground">
          Transform your story idea into a complete cinematic storyboard with AI-generated scenes
        </p>
      </div>


      {/* Success Message */}
      {creationResult && (
        <div className="mb-4 p-3 bg-muted/30 border rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Story created successfully!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {creationResult.totalScenes} scenes • Images are now generating
          </p>
        </div>
      )}

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Story Prompt
          </CardTitle>
          <CardDescription>
            Describe your story idea, characters, setting, and tone. Be as detailed or creative as you like.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="A detective investigates mysterious disappearances in a neon-lit cyberpunk city, discovering a conspiracy involving AI consciousness and corporate cover-ups..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-32 text-base"
            disabled={isGenerating}
            maxLength={2000}
          />
          
          <div className="flex justify-end">
            <div className="flex gap-2">
              {creationResult && (
                <Button variant="outline" onClick={resetForm} disabled={isGenerating}>
                  Create Another
                </Button>
              )}
              <Button 
                onClick={handleGenerateStoryboard}
                disabled={!prompt.trim() || isGenerating || prompt.length < 20}
                className="min-w-32"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Storyboard
                  </>
                )}
              </Button>
            </div>
          </div>

          {isGenerating && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">{currentStep}</span>
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div 
                  className="h-2 bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

    </div>
  );
}