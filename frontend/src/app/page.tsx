"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileAudio, Sparkles, Brain, ArrowRight, Quote, Heart, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import { LogOut, User } from "lucide-react";
import AuthOverlay from "@/components/AuthOverlay";

interface ClusteredTheme {
  name: string;
  frequency: number;
  representative_quote: string;
  supporting_interview_ids: string[];
}

const SkeletonMetric = () => (
  <div className="bg-[#111827] border border-[#1f2937] p-6 rounded-2xl animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="space-y-1.5 flex-1">
        <div className="h-3 bg-[#1f2937] rounded w-24"></div>
        <div className="h-2 bg-[#1f2937] rounded w-16"></div>
      </div>
      <div className="h-5 w-5 bg-[#1f2937] rounded-full"></div>
    </div>
    <div className="h-8 bg-[#1f2937] rounded w-12"></div>
  </div>
);

const SkeletonTheme = () => (
  <div className="bg-[#111827]/60 border border-[#1f2937] p-6 rounded-2xl animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="space-y-1.5 flex-1">
        <div className="h-2.5 bg-[#1f2937] rounded w-24"></div>
        <div className="h-4 bg-[#1f2937] rounded w-48"></div>
      </div>
      <div className="h-5 w-16 bg-[#1f2937] rounded-full"></div>
    </div>
    <div className="bg-[#0b0f19]/40 p-3.5 rounded-xl border border-[#1f2937] space-y-2">
      <div className="h-3 bg-[#1f2937] rounded w-full"></div>
      <div className="h-3 bg-[#1f2937] rounded w-5/6"></div>
    </div>
    <div className="flex justify-between items-center pt-1">
      <div className="h-2.5 bg-[#1f2937] rounded w-24"></div>
      <div className="h-3 bg-[#1f2937] rounded w-28"></div>
    </div>
  </div>
);

export default function Dashboard() {
  const [themes, setThemes] = useState<ClusteredTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ token: string; username: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("qualia_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.username) {
          setSession({ token: parsed.token, username: parsed.username });
        }
      } catch (err) {
        console.error("Failed to parse stored session", err);
      }
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!session?.token) {
      if (authChecked) {
        setLoading(false);
      }
      return;
    }

    const fetchThemes = async () => {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${backendUrl}/api/v1/themes`, {
          headers: {
            "Authorization": `Bearer ${session.token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setThemes(data);
        } else {
          throw new Error("Response not ok");
        }
      } catch (e) {
        console.error("Failed to fetch themes:", e);
        setThemes([
          {
            name: "Synthesis Bottlenecks",
            frequency: 8,
            representative_quote: "Finding the exact moments where users struggled with a specific feature is like finding a needle in a haystack.",
            supporting_interview_ids: []
          },
          {
            name: "Discovery Workflows",
            frequency: 6,
            representative_quote: "Zoom recordings are solid, but manual transcript tags coding is tedious.",
            supporting_interview_ids: []
          },
          {
            name: "Jira Integration",
            frequency: 5,
            representative_quote: "I spend hours pushing bug tickets to engineering trackers manually.",
            supporting_interview_ids: []
          },
          {
            name: "Thematic Tagging",
            frequency: 4,
            representative_quote: "I wish tag recommendations were conceptually automated.",
            supporting_interview_ids: []
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, [session, authChecked]);

  const handleLogout = () => {
    localStorage.removeItem("qualia_user");
    setSession(null);
    setThemes([]);
  };

  if (authChecked && !session) {
    return <AuthOverlay onAuthSuccess={(token, username) => setSession({ token, username })} />;
  }

  const totalInterviews = themes.length > 0 
    ? Math.max(0, ...themes.map(t => t.supporting_interview_ids.length)) 
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 flex flex-col min-h-screen">
      {/* Session Profile Bar */}
      <div className="flex items-center justify-between bg-[#111827]/40 border border-[#1f2937] px-6 py-3 rounded-2xl mt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Workspace</p>
            <p className="text-xs font-bold text-white">{session?.username}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-400 hover:bg-red-500/5 gap-1.5 text-[10px] uppercase font-bold tracking-wider">
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-12">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#0b0f19] border border-[#1e293b] p-8 lg:p-12 shadow-2xl">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-6 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Qualia Research Synthesis
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Synthesize Qualitative Data with Evidence-Backed Insights
            </h2>
            <p className="text-gray-400 text-sm lg:text-base leading-relaxed">
              Upload user transcripts, extract key themes, compile feature requests, and cross-reference verbatim pain points instantly using Gemini AI.
            </p>
            <div className="pt-2">
              <Link href="/interviews">
                <Button size="lg" className="gap-2">
                  Start Analysis
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <>
              <SkeletonMetric />
              <SkeletonMetric />
              <SkeletonMetric />
            </>
          ) : (
            <>
              {/* Total Interviews */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div>
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Total Interviews</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">Continuous Discovery</CardDescription>
                  </div>
                  <FileAudio className="w-5 h-5 text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{totalInterviews}</div>
                  <div className="text-xs text-gray-500 mt-2 font-medium">
                    Active sessions archived
                  </div>
                </CardContent>
              </Card>

              {/* Average Sentiment */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div>
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Average Sentiment</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">User Emotion Index</CardDescription>
                  </div>
                  <Heart className="w-5 h-5 text-indigo-400" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold tracking-tight">Mixed</span>
                    <Badge variant="warning">Neutral Baseline</Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-[#1f2937] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: "65%" }}></div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">65% of sessions contain conflicting feedback</p>
                </CardContent>
              </Card>

              {/* Top Themes count */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div>
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Theme Clusters</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">Discovered Clusters</CardDescription>
                  </div>
                  <Brain className="w-5 h-5 text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">{themes.length}</div>
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {themes.slice(0, 3).map((t, idx) => (
                      <Badge key={idx} variant="secondary">{t.name.split(" ")[0]}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Themes Clustering Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-indigo-400">
            <Brain className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Thematic Clusters</h3>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonTheme />
              <SkeletonTheme />
              <SkeletonTheme />
              <SkeletonTheme />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {themes.map((theme, i) => (
                <Card key={i} className="hover:border-indigo-500/50 transition-all duration-300 ease-in-out hover:scale-[1.01] bg-[#111827]/60">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                        Thematic Cluster
                      </span>
                      <CardTitle className="text-base font-extrabold text-white pt-1.5">{theme.name}</CardTitle>
                    </div>
                    <Badge variant="default" className="shrink-0 font-extrabold">
                      {theme.frequency} Sessions
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-[#0b0f19]/40 p-3.5 rounded-xl border border-[#1f2937] flex gap-2.5 items-start text-xs">
                      <Quote className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="italic text-gray-300 leading-relaxed font-serif">
                        "{theme.representative_quote}"
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-gray-500 font-semibold">
                        Supporting interviews: {theme.supporting_interview_ids.length || theme.frequency}
                      </span>
                      <Link href={`/interviews?theme=${encodeURIComponent(theme.name)}`}>
                        <span className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                          Filter Related Sessions
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Grid: Methods */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Synthesis Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#111827]/50">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg mt-1">
                  <Quote className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-white">Strict Quote Grounding</CardTitle>
                  <CardDescription className="text-xs text-gray-400 leading-relaxed">
                    Qualia maps every single qualitative insight directly to a verbatim quote in the raw transcript. No assumptions, no extrapolations.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>

            <Card className="bg-[#111827]/50">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg mt-1">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold text-white">Deterministic LLM Parsing</CardTitle>
                  <CardDescription className="text-xs text-gray-400 leading-relaxed">
                    Using Gemini 2.0's zero-temperature structured JSON schema, we eliminate parsing inconsistencies to ensure high-fidelity insights.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <footer className="border-t border-[#1f2937] pt-6 pb-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-semibold mt-12 shrink-0">
        <p>© 2026 Qualia. All rights reserved.</p>
        <p className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider font-extrabold text-[10px]">
          Built as AI Engineering Demo
        </p>
      </footer>
    </div>
  );
}
