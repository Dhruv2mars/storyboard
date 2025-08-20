"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserInitializer() {
  const { user, isLoaded } = useUser();
  const [initAttempted, setInitAttempted] = useState(false);
  
  // Disable user initialization in production until Convex is properly configured
  const isProduction = process.env.NODE_ENV === 'production';
  const initializeUser = useMutation(api.userInit.initializeUser);

  useEffect(() => {
    // Skip initialization in production or if already attempted
    if (isProduction || initAttempted || !isLoaded || !user?.id) {
      return;
    }

    setInitAttempted(true);

    // Initialize user in Convex database with error boundaries
    const initUser = async () => {
      try {
        await initializeUser({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || "User",
          imageUrl: user.imageUrl,
        });
        console.log("User initialized successfully");
      } catch (error) {
        // Silently handle errors in production - don't break the app
        console.warn("User initialization skipped:", error instanceof Error ? error.message : "Unknown error");
      }
    };

    initUser();
  }, [isLoaded, user?.id, user?.firstName, user?.fullName, user?.imageUrl, user?.primaryEmailAddress?.emailAddress, initializeUser, isProduction, initAttempted]);

  // This component doesn't render anything
  return null;
}