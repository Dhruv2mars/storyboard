"use client";

import { ReactNode, useMemo, useState, useEffect } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    
    if (!url) {
      console.warn("Missing NEXT_PUBLIC_CONVEX_URL environment variable - using fallback mode");
      // Return a dummy client that won't make actual requests
      return new ConvexReactClient("https://fallback.convex.cloud");
    }

    // Ensure the URL is properly formatted
    const formattedUrl = url.startsWith('http') 
      ? url 
      : `https://${url.replace(/^\/+/, '')}`;

    console.log("Initializing Convex with URL:", formattedUrl);
    return new ConvexReactClient(formattedUrl);
  }, []);

  // Show loading during hydration to prevent SSR mismatch
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}