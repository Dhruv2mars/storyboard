"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Sparkles, Clock, DollarSign } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StoryCreator } from "@/components/StoryCreator";
import { StoryboardViewer } from "@/components/StoryboardViewer";

type ViewMode = 'create' | 'view';

interface ViewState {
  mode: ViewMode;
  storyboardId?: string;
}

export default function Home() {
  const { user } = useUser();
  const [viewState, setViewState] = useState<ViewState>({ mode: 'create' });
  
  // Get user's storyboards to find current story title
  const storyboards = useQuery(
    api.storyboards.getUserStoryboards,
    user?.id ? { userId: user.id } : "skip"
  );
  
  // Find current storyboard title
  const currentStoryboard = viewState.storyboardId 
    ? storyboards?.find(sb => sb._id === viewState.storyboardId)
    : null;
  
  const handleStoryboardSelect = (storyboardId: string) => {
    setViewState({ mode: 'view', storyboardId });
  };

  const handleNewStoryboard = () => {
    setViewState({ mode: 'create' });
  };

  const handleStoryCreated = (storyboardId: string) => {
    setViewState({ mode: 'view', storyboardId });
  };


  return (
    <>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="container mx-auto px-4 py-8 sm:py-16 max-w-4xl text-center">
            <div className="mb-8 sm:mb-12">
              <Film className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-4 sm:mb-6 text-primary" />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">AI Storyboard Generator</h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed">
                Transform your story ideas into professional cinematic storyboards with AI-generated 
                black and white sketches. Sign in to get started.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
              <Card className="text-center">
                <CardHeader>
                  <Sparkles className="w-12 h-12 text-primary mb-4 mx-auto" />
                  <CardTitle className="text-xl">AI-Powered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Advanced AI models generate detailed scene descriptions and professional sketches
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardHeader>
                  <Clock className="w-12 h-12 text-primary mb-4 mx-auto" />
                  <CardTitle className="text-xl">Fast Generation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Get complete storyboards with 3-5 scenes in under a minute
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardHeader>
                  <DollarSign className="w-12 h-12 text-primary mb-4 mx-auto" />
                  <CardTitle className="text-xl">Affordable</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Professional storyboards starting at just $0.12-0.20 per complete board
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <SignInButton mode="modal">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <AppLayout
          activeStoryboardId={viewState.storyboardId}
          onStoryboardSelect={handleStoryboardSelect}
          onNewStoryboard={handleNewStoryboard}
          currentStoryTitle={currentStoryboard?.title}
        >
          {viewState.mode === 'create' ? (
            <StoryCreator onStoryCreated={handleStoryCreated} />
          ) : (
            viewState.storyboardId && (
              <StoryboardViewer storyboardId={viewState.storyboardId} />
            )
          )}
        </AppLayout>
      </SignedIn>
    </>
  );
}
