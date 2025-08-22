"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-react";

export function BYOKSettings() {
  const { user } = useUser();
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Convex hooks
  const setUserApiKey = useMutation(api.apiKeyManager.setUserApiKey);
  const removeUserApiKey = useMutation(api.apiKeyManager.removeUserApiKey);
  const toggleBYOK = useMutation(api.apiKeyManager.toggleBYOK);
  const byokStatus = useQuery(
    api.apiKeyManager.getUserBYOKStatus,
    user?.id ? { userId: user.id } : "skip"
  );

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSetApiKey = async () => {
    if (!apiKey.trim() || !user?.id) return;
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const result = await setUserApiKey({
        userId: user.id,
        apiKey: apiKey.trim(),
        userName: user.fullName || user.firstName || "User",
        userEmail: user.primaryEmailAddress?.emailAddress || undefined,
      });
      
      if (result.success) {
        setMessage({ type: 'success', text: 'API key saved successfully! BYOK is now enabled.' });
        setApiKey("");
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save API key' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!user?.id) return;
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const result = await removeUserApiKey({ userId: user.id });
      
      if (result.success) {
        setMessage({ type: 'success', text: 'API key removed successfully.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to remove API key' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove API key. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBYOK = async (enabled: boolean) => {
    if (!user?.id) return;
    
    try {
      const result = await toggleBYOK({
        userId: user.id,
        enabled,
      });
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `BYOK ${enabled ? 'enabled' : 'disabled'} successfully.` 
        });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update BYOK setting' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update BYOK setting. Please try again.' });
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-lg font-semibold mb-2">Bring Your Own Key</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use your Gemini API key to skip the queue and get instant processing.
        </p>
      </div>

      {/* Current Status */}
      {byokStatus && byokStatus.hasApiKey && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
          <span className="text-sm font-medium">Status: Active</span>
          <Switch
            checked={byokStatus.byokEnabled}
            onCheckedChange={handleToggleBYOK}
          />
        </div>
      )}

      {/* Get API Key */}
      <div className="flex items-center justify-between p-3 border rounded">
        <div>
          <p className="font-medium text-sm">Get API Key</p>
          <p className="text-xs text-muted-foreground">From Google AI Studio</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-2" />
          Get Key
        </Button>
      </div>

      {/* API Key Input */}
      {!byokStatus?.hasApiKey ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSubmitting}
              className="flex-1"
            />
            <Button 
              onClick={handleSetApiKey}
              disabled={!apiKey.trim() || isSubmitting}
              size="sm"
              className="sm:w-auto"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 border rounded">
          <div>
            <p className="font-medium text-sm">API Key Set</p>
            <p className="text-xs text-muted-foreground">
              Added: {byokStatus.apiKeyUpdatedAt ? 
                new Date(byokStatus.apiKeyUpdatedAt).toLocaleDateString() : 
                'Recently'
              }
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRemoveApiKey}
            disabled={isSubmitting}
          >
            Remove
          </Button>
        </div>
      )}

      {message && (
        <div className={`p-3 text-sm rounded ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}