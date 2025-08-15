"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, Calendar, DollarSign, Trash2 } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { user } = useUser();
  
  // Get user's storyboards
  const convexUser = useQuery(api.users.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );
  
  const storyboards = useQuery(api.storyboards.getUserStoryboards,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Please sign in to view your dashboard</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Storyboards</h1>
        <p className="text-muted-foreground">
          Manage and view your AI-generated cinematic storyboards
        </p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            {storyboards?.length || 0} storyboards created
          </Badge>
          <Badge variant="outline">
            Total cost: ${storyboards?.reduce((sum, sb) => sum + (sb.actualCost || 0), 0).toFixed(3)}
          </Badge>
        </div>
        <Link href="/">
          <Button>
            <Film className="w-4 h-4 mr-2" />
            Create New Storyboard
          </Button>
        </Link>
      </div>

      {!storyboards ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : storyboards.length === 0 ? (
        <div className="text-center py-16">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No storyboards yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first AI-generated storyboard to get started
          </p>
          <Link href="/">
            <Button>
              <Film className="w-4 h-4 mr-2" />
              Create Your First Storyboard
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((storyboard) => (
            <Card key={storyboard._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">
                      {storyboard.title}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {storyboard.originalPrompt}
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
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Film className="w-4 h-4" />
                      {storyboard.sceneCount} scenes
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      ${storyboard.actualCost?.toFixed(3) || "0.000"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(storyboard._creationTime).toLocaleDateString()}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}