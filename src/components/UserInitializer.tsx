"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserInitializer() {
  const { user, isLoaded } = useUser();
  const initializeUser = useMutation(api.userInit.initializeUser);

  useEffect(() => {
    if (isLoaded && user?.id) {
      // Initialize user in Convex database
      initializeUser({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || "User",
        imageUrl: user.imageUrl,
      }).catch(() => {
        // Silently handle errors - user might already exist
        console.log("User initialization completed or already exists");
      });
    }
  }, [isLoaded, user?.id, user?.firstName, user?.fullName, user?.imageUrl, user?.primaryEmailAddress?.emailAddress, initializeUser]);

  // This component doesn't render anything
  return null;
}