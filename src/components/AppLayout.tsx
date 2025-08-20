"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Film, 
  Plus, 
  Settings, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BYOKSettings } from "@/components/BYOKSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useClerk } from "@clerk/nextjs";

interface AppLayoutProps {
  children: React.ReactNode;
  activeStoryboardId?: string;
  onStoryboardSelect?: (storyboardId: string) => void;
  onNewStoryboard?: () => void;
  currentStoryTitle?: string;
}

export function AppLayout({ 
  children, 
  activeStoryboardId, 
  onStoryboardSelect, 
  onNewStoryboard,
  currentStoryTitle 
}: AppLayoutProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Get user's storyboards with error handling
  const storyboards = useQuery(
    api.storyboards.getUserStoryboards,
    user?.id ? { userId: user.id } : "skip"
  );
  
  // Delete mutation
  const deleteStoryboard = useMutation(api.storyboards.deleteStoryboard);
  
  const handleDelete = async (storyboardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    if (!confirm("Delete this storyboard? This action cannot be undone.")) return;
    
    try {
      await deleteStoryboard({ 
        storyboardId: storyboardId as never, 
        userId: user.id 
      });
    } catch (error) {
      console.error("Failed to delete storyboard:", error);
      alert("Failed to delete storyboard. Please try again.");
    }
  };


  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-muted/30 flex flex-col overflow-hidden lg:relative absolute lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} z-40`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              <span className="font-semibold">Storyboard</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          
          <Button
            onClick={onNewStoryboard}
            className="w-full"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Storyboard
          </Button>
        </div>

        {/* Story History */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium text-muted-foreground">Recent Stories</h3>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-4 py-2">
              <div className="space-y-2">
              {storyboards && storyboards.length > 0 ? storyboards.map((story) => (
                <div
                  key={story._id}
                  onClick={() => {
                    onStoryboardSelect?.(story._id);
                    // Close sidebar on mobile after selection
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                    activeStoryboardId === story._id 
                      ? 'bg-primary/10 border-primary/20' 
                      : 'border-border/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium line-clamp-1 mb-1">
                        {story.title}
                      </h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Film className="w-3 h-3" />
                        <span>{story.totalScenes} scenes</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(story._id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )) : null}
              
              {storyboards === undefined && (
                <div className="text-center py-8 text-muted-foreground">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Loading stories...</p>
                </div>
              )}
              
              {storyboards && storyboards.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No storyboards yet</p>
                  <p className="text-xs">Create your first story to get started</p>
                </div>
              )}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        {/* User Menu */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground">
                {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium truncate">
                {user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User'}
              </span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  BYOK Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {!sidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
                {!sidebarOpen && (
                  <div className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Storyboard</span>
                  </div>
                )}
                {currentStoryTitle && (
                  <h1 className="text-lg font-semibold">{currentStoryTitle}</h1>
                )}
              </div>
            </div>
            
            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BYOK Settings</DialogTitle>
          </DialogHeader>
          <BYOKSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
}