"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    
    if (!url) {
      console.warn("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
      // Return a dummy client during build time to prevent build failures
      return new ConvexReactClient("https://dummy.convex.cloud");
    }

    // Ensure the URL is properly formatted
    const formattedUrl = url.startsWith('http') 
      ? url 
      : `https://${url.replace(/^\/+/, '')}`;

    return new ConvexReactClient(formattedUrl);
  }, []);

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}