"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, LogIn, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BACKEND_URL } from "@/config";

interface AuthOverlayProps {
  onAuthSuccess: (token: string, username: string) => void;
}

export default function AuthOverlay({ onAuthSuccess }: AuthOverlayProps) {
  const [username, setUsername] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    const endpoint = isSignup ? "/api/v1/auth/signup" : "/api/v1/auth/login";

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication request failed.");
      }

      // Store in localStorage
      const userSession = {
        user_id: data.user_id,
        token: data.token,
        username: data.username,
      };
      localStorage.setItem("autosight_user", JSON.stringify(userSession));

      onAuthSuccess(data.token, data.username);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/95 backdrop-blur-md p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      <Card className="w-full max-w-md bg-[#0f172a]/70 border-[#1f2937] shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 w-fit">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Welcome to Autosight
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-white">
            {isSignup ? "Create a Research Session" : "Access Research Session"}
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs">
            {isSignup 
              ? "Register a private workspace handle. No passwords needed for this portfolio demo." 
              : "Enter your username to access your secure user-scoped research uploads."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Workspace Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))}
                placeholder="e.g. John Doe"
                disabled={loading}
                className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border-l-4 border-red-500 text-red-300 p-3 rounded-r-xl flex gap-2.5 items-start text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full gap-2 py-5" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : isSignup ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Sign Up & Start Session
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Enter Workspace
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError(null);
              }}
              disabled={loading}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              {isSignup 
                ? "Already have a research handle? Log in" 
                : "Need a new workspace? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
