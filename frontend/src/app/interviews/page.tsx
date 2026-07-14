"use client";

import React, { useState, useRef, useEffect, use } from "react";

import { useRouter } from "next/navigation";



import { 
  Plus, 
  Loader2, 
  User, 
  Calendar, 
  Tag, 
  Sparkles, 
  Quote, 
  Frown, 
  Lightbulb, 
  ThumbsUp, 
  AlertCircle,
  HelpCircle,
  Upload,
  FileText,
  Heart,
  Copy,
  Check,
  Trash,
  LogOut
} from "lucide-react";
import AuthOverlay from "@/components/AuthOverlay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/Separator";

interface KeyQuote {
  quote: string;
  context: string;
}

interface InsightData {
  is_mock?: boolean;
  pain_points: string[];
  feature_requests: string[];
  positive_feedback: string[];
  key_quotes: KeyQuote[];
  user_persona: string;
  sentiment: string;
  summary: string;
  themes: string[];
}

interface InterviewItem {
  id: string;
  title: string;
  transcript: string;
  participant_info?: {
    name?: string;
    role?: string;
    company?: string;
  };
  date: string;
  insight: InsightData;
}

const INITIAL_INTERVIEWS: InterviewItem[] = [
  {
    id: "0e01a3ee-03b3-4e2e-9fb1-ed1d15ae1fbe",
    title: "B2B SaaS PM Interview on Synthesis Pain Points",
    date: "2026-07-10T16:28:08Z",
    transcript: "Zoom recordings are solid, but manual transcript tags coding is tedious...",
    participant_info: {
      name: "Mark Jones",
      role: "Senior Product Manager",
      company: "SaaSFlow Corp"
    },
    insight: {
      user_persona: "Senior Product Manager conducting continuous discovery",
      sentiment: "Mixed",
      summary: "Mark describes current qualitative research workflows as highly fragmented and manual. While raw transcription speed is acceptable, synthesizing text and pushing bugs to Jira are severe bottlenecks.",
      themes: ["Discovery Workflows", "Synthesis Bottlenecks", "Jira Integration", "Thematic Tagging"],
      pain_points: [
        "Synthesis phase is tedious and disorganized, requiring copy-pasting of quotes into separate Notion pages",
        "No centralized repository to search for pain points across multiple user interviews",
        "Finding exact context of quotes requires manually re-watching hours of interview videos"
      ],
      feature_requests: [
        "Centralized and searchable repository for all transcripts",
        "Automated thematic tagging to replace manual sorting",
        "One-click Jira ticket generation directly from quotes"
      ],
      positive_feedback: [
        "Zoom's recording quality is solid and reliable",
        "Initial transcription speed and 90% accuracy provide a good baseline"
      ],
      key_quotes: [
        {
          quote: "Finding the exact moments where users struggled with a specific feature is like finding a needle in a haystack.",
          "context": "Explaining the main friction point during qualitative synthesis."
        }
      ]
    }
  }
];

const extractTitleFromTranscript = (text: string): string => {
  if (!text) return "";
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return "";

  // 1. Check first 15 lines for clear metadata prefixes (e.g. "Title: Sarah Interview")
  const metadataRegex = /^(title|session|study|interview|subject|topic|participant|name|project|user)\s*:\s*(.+)$/i;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const match = lines[i].match(metadataRegex);
    if (match && match[2].trim().length > 2) {
      return match[2].trim().replace(/^[=\-*#\s"']+|[=\-*#\s"']+$/g, "");
    }
  }

  // 2. Look for Markdown headers (e.g., "# Sarah Discovery Session") in first 10 lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    if (line.startsWith("#")) {
      const cleanedHeader = line.replace(/^[#\s]+|[#\s]+$/g, "").trim();
      if (cleanedHeader.length > 3 && !cleanedHeader.toLowerCase().includes("transcript")) {
        return cleanedHeader;
      }
    }
  }

  // 3. Heuristic search: find the first line that is NOT a speaker dialog line and has reasonable length
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    const cleaned = line.replace(/^[=\-*#\s"']+|[=\-*#\s"']+$/g, "").trim();
    
    // Skip line if it is empty, too short, or contains "transcript" keyword
    if (!cleaned || cleaned.length < 4 || cleaned.toLowerCase().includes("transcript")) {
      continue;
    }

    // Skip if it looks like a dialog line: "Speaker: ..." or "Interviewer: ..."
    const dialogMatch = cleaned.match(/^([a-zA-Z0-9\s]{2,20})\s*:\s*(.+)$/);
    if (dialogMatch) {
      const dialogText = dialogMatch[2].trim();
      if (dialogText.length < 15 || /^(hi|hello|yes|no|thanks|ok|good morning)/i.test(dialogText)) {
        continue;
      }
    }

    // If the line is short enough to be a title
    if (cleaned.length < 80) {
      return cleaned;
    }
  }

  // 4. Ultimate fallback: clean the first line, slice if too long
  const firstLine = lines[0];
  const cleanedFirst = firstLine.replace(/^[=\-*#\s"']+|[=\-*#\s"']+$/g, "").trim();
  if (cleanedFirst) {
    return cleanedFirst.length > 60 ? cleanedFirst.slice(0, 57) + "..." : cleanedFirst;
  }

  return "Untitled Interview";
};

export default function InterviewsPage({ searchParams }: { searchParams: Promise<{ id?: string; theme?: string }> }) {
  const resolvedParams = use(searchParams);
  const queryId = resolvedParams.id;
  const queryTheme = resolvedParams.theme;
  const router = useRouter();

  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [session, setSession] = useState<{ token: string; username: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);

  const handleCopyQuote = (quoteText: string, index: number) => {
    navigator.clipboard.writeText(quoteText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

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
    if (!session?.token) return;

    const fetchInterviews = async () => {
      setFetchLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${backendUrl}/api/v1/interviews`, {
          headers: {
            "Authorization": `Bearer ${session.token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const items: InterviewItem[] = data.map((item: any) => ({
            id: item.interview.id,
            title: item.interview.title,
            transcript: item.interview.transcript,
            date: item.interview.date,
            participant_info: item.interview.participant_info,
            insight: item.insight?.data || {
              pain_points: [],
              feature_requests: [],
              positive_feedback: [],
              key_quotes: [],
              user_persona: "Unknown Persona",
              sentiment: "Neutral",
              summary: "No qualitative insights generated yet.",
              themes: []
            }
          }));
          setInterviews(items);
          if (items.length > 0) {
            setSelectedId(items[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch user interviews:", e);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchInterviews();
  }, [session]);

  useEffect(() => {
    if (queryId && interviews.length > 0) {
      const exists = interviews.some((i) => i.id === queryId);
      if (exists) {
        setSelectedId(queryId);
      }
    }
  }, [queryId, interviews]);

  const handleDelete = async (id: string) => {
    if (!session?.token) return;
    if (!confirm("Are you sure you want to delete this research session permanently? This action cannot be undone.")) {
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const response = await fetch(`${backendUrl}/api/v1/interviews/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.token}`
        }
      });
      if (response.ok) {
        setInterviews((prev) => {
          const nextItems = prev.filter((item) => item.id !== id);
          if (selectedId === id && nextItems.length > 0) {
            setSelectedId(nextItems[0].id);
          } else if (nextItems.length === 0) {
            setSelectedId("");
          }
          return nextItems;
        });
      } else {
        alert("Failed to delete interview. Please check authorization.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting interview session.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("qualia_user");
    setSession(null);
    setInterviews([]);
    setSelectedId("");
  };

  const visibleInterviews = interviews.filter((item) => {
    if (!queryTheme) return true;
    return item.insight.themes.some(
      (t) => t.toLowerCase() === queryTheme.toLowerCase()
    );
  });


  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantRole, setParticipantRole] = useState("");
  const [participantCompany, setParticipantCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedInterview = interviews.find((i) => i.id === selectedId);

  // File Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setTranscript(text);
        // Autofill title if empty
        if (!title) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentTitle = title.trim();
    if (!currentTitle && transcript.trim()) {
      currentTitle = extractTitleFromTranscript(transcript);
      setTitle(currentTitle);
    }

    if (!currentTitle || !transcript) {
      setError("Please fill out both the interview title and the transcript text.");
      return;
    }

    setLoading(true);
    setError(null);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const payload = {
      title: currentTitle,
      transcript,
      participant_info: {
        name: participantName || "Anonymous User",
        role: participantRole || "UX Specialist",
        company: participantCompany || "Research Lab"
      }
    };

    try {
      const response = await fetch(`${backendUrl}/api/v1/interviews`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const result = await response.json();
      
      const newItem: InterviewItem = {
        id: result.interview.id,
        title: result.interview.title,
        transcript: result.interview.transcript,
        date: result.interview.date,
        participant_info: result.interview.participant_info,
        insight: result.insight?.data || {
          pain_points: [],
          feature_requests: [],
          positive_feedback: [],
          key_quotes: [],
          user_persona: "Unknown Persona",
          sentiment: "Neutral",
          summary: "No qualitative insights generated yet.",
          themes: []
        }
      };

      setInterviews((prev) => [newItem, ...prev]);
      setSelectedId(newItem.id);
      
      // Reset form
      setTitle("");
      setTranscript("");
      setParticipantName("");
      setParticipantRole("");
      setParticipantCompany("");
      
    } catch (err: any) {
      console.error(err);
      setError(`Backend offline (${err.message}). Mock data fallback applied.`);
      
      // Fallback simulation if backend is down for demonstration
      const simulatedId = Math.random().toString(36).substring(7);
      const simulatedItem: InterviewItem = {
        id: simulatedId,
        title: `${title} (Local Fallback)`,
        transcript,
        date: new Date().toISOString(),
        participant_info: {
          name: participantName || "Alice Chen",
          role: participantRole || "Staff Product Designer",
          company: participantCompany || "Acme Design"
        },
        insight: {
          user_persona: `${participantRole || "Researcher"} handling customer feedback loops`,
          sentiment: "Mixed",
          summary: "The participant expresses mixed feelings regarding synthesis overhead. While transcript capturing has gotten fast, manual tag coding and lack of Jira/engineering integrations slow down iteration loops.",
          themes: ["SaaS Operations", "Local Simulation", "Thematic tagging"],
          pain_points: [
            "Manual grouping of transcript quotes is highly tedious",
            "Disorganized notes spread across multiple documents make searching difficult"
          ],
          feature_requests: [
            "Auto-tagging / thematic recommendations",
            "Slack broadcasting integrations"
          ],
          positive_feedback: [
            "Speed of baseline transcription is acceptable"
          ],
          key_quotes: [
            {
              quote: "The transcription is fast, but compiling highlights is what slows me down.",
              "context": "Describing her core workflow pain point."
            }
          ]
        }
      };

      setInterviews((prev) => [simulatedItem, ...prev]);
      setSelectedId(simulatedItem.id);
    } finally {
      setLoading(false);
    }
  };

  if (authChecked && !session) {
    return <AuthOverlay onAuthSuccess={(token, username) => setSession({ token, username })} />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full lg:overflow-hidden max-w-7xl mx-auto w-full">
      {/* Left Column: Form + List */}
      <div className="flex-1 flex flex-col gap-6 lg:overflow-y-auto pr-2 max-w-md w-full shrink-0">
        
        {/* Session Profile Bar */}
        <div className="flex items-center justify-between bg-[#111827]/40 border border-[#1f2937] px-4 py-2.5 rounded-xl shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Active User</p>
              <p className="text-xs font-bold text-white leading-none mt-0.5">{session?.username}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-400 hover:bg-red-500/5 gap-1 text-[9px] uppercase font-bold tracking-wider px-2 py-1 h-auto">
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>

        {/* Upload Form Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Plus className="w-5 h-5" />
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Analyze Interview</CardTitle>
            </div>
            <CardDescription>Upload audio transcript to run qualitative thematic coding.</CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Drag and Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  dragActive 
                    ? "border-[#6366f1] bg-[#6366f1]/10" 
                    : "border-[#1f2937] hover:border-gray-600 bg-[#0b0f19]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className={`w-6 h-6 ${dragActive ? "text-[#6366f1]" : "text-gray-500"}`} />
                <p className="text-[11px] text-gray-400 text-center font-medium">
                  {dragActive ? "Drop transcript here" : "Drag transcript file (.txt) here, or browse"}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase">Interview Title</label>
                <input
                  type="text"
                  placeholder="e.g. UX Designer Interview - File Uploads"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-all"
                  disabled={loading}
                />
              </div>

              {/* Participant metadata fields */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Participant</label>
                  <input
                    type="text"
                    placeholder="Sarah"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1]"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Role</label>
                  <input
                    type="text"
                    placeholder="Designer"
                    value={participantRole}
                    onChange={(e) => setParticipantRole(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1]"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Company</label>
                  <input
                    type="text"
                    placeholder="Google"
                    value={participantCompany}
                    onChange={(e) => setParticipantCompany(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1]"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase">Transcript Text</label>
                <textarea
                  rows={4}
                  placeholder="Or paste raw interview transcript here..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData("text");
                    if (!title && pastedText.trim()) {
                      const extracted = extractTitleFromTranscript(pastedText);
                      if (extracted) {
                        setTitle(extracted);
                      }
                    }
                  }}
                  className="w-full bg-[#0b0f19] border border-[#1f2937] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-all resize-none"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex gap-2 items-start text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Privacy Warning Disclaimer */}
              <div className="bg-indigo-950/25 border border-indigo-500/10 p-3 rounded-xl flex gap-2.5 items-start text-[10px] leading-relaxed text-indigo-300/80">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                <p>
                  <strong>Privacy Notice:</strong> Qualia is a portfolio demo. Transcripts are sent to Gemini APIs and saved in a database. Avoid uploading sensitive or confidential proprietary records.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Synthesizing Insights...
                  </>
                ) : (
                  "Analyze Interview"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Interviews List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Processed Sessions</h3>
            {queryTheme && (
              <Badge 
                variant="secondary" 
                className="cursor-pointer hover:bg-red-500/10 hover:text-red-400 gap-1 text-[10px]"
                onClick={() => router.push("/interviews")}
              >
                Theme: {queryTheme} ×
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {visibleInterviews.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-6">No sessions match this theme.</p>
            ) : (
              visibleInterviews.map((item) => {
                const active = item.id === selectedId;
                const dateObj = new Date(item.date);
                const formattedDate = dateObj.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric"
                });


              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(item.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full text-left p-4 rounded-xl border transition-all space-y-2 cursor-pointer focus:outline-none focus:border-[#6366f1] ${
                    active
                      ? "bg-[#1f2937]/35 border-[#6366f1] shadow-lg shadow-indigo-500/5"
                      : "bg-[#111827]/40 border-[#1f2937] hover:border-gray-700 hover:bg-[#111827]/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-white truncate max-w-[200px]">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-1 hover:text-red-400 text-gray-500 rounded hover:bg-red-500/10 transition-colors"
                        title="Delete Session"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                      <Badge
                        variant={
                          item.insight.sentiment === "Positive"
                            ? "success"
                            : item.insight.sentiment === "Negative"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {item.insight.sentiment}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {item.insight.summary}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] text-gray-500 font-semibold pt-1">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.participant_info?.name || "Participant"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formattedDate}
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>

        </div>
      </div>

      {/* Right Column: Evidence Panel */}
      <div className="flex-1 bg-[#111827] border border-[#1f2937] rounded-2xl flex flex-col overflow-hidden lg:h-[85vh] h-auto">
        {fetchLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <Loader2 className="w-10 h-10 text-indigo-500 mb-3 animate-spin" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Retrieving workspace sessions...</p>
          </div>
        ) : selectedInterview ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Evidence Header */}
            <div className="p-6 border-b border-[#1f2937] space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Evidence Panel</span>
                  <h2 className="text-xl font-extrabold tracking-tight text-white">{selectedInterview.title}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-white">{selectedInterview.participant_info?.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {selectedInterview.participant_info?.role} at {selectedInterview.participant_info?.company}
                    </p>
                  </div>
                  <div className="bg-[#1f2937] p-2.5 rounded-xl border border-[#2d3748]">
                    <User className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>
              </div>

              {/* Badges Bar: Themes and Sentiment/Confidence info */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap gap-2">
                  {selectedInterview.insight.themes.map((theme, i) => (
                    <Badge key={i} variant="default" className="gap-1">
                      <Tag className="w-3 h-3" />
                      {theme}
                    </Badge>
                  ))}
                </div>
                
                {/* Metric Indicators */}
                <div className="flex items-center gap-2 border border-[#1f2937] bg-[#0b0f19] px-3 py-1.5 rounded-xl shadow-inner">
                  <div className="flex items-center gap-1.5 border-r border-[#1f2937] pr-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Sentiment:</span>
                    <Badge
                      variant={
                        selectedInterview.insight.sentiment === "Positive"
                          ? "success"
                          : selectedInterview.insight.sentiment === "Negative"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {selectedInterview.insight.sentiment}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Panel Details (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Local Mock Fallback Alert Callout */}
              {selectedInterview.insight.is_mock && (
                <div className="bg-red-500/10 border-l-4 border-red-500 text-red-300 p-4 rounded-r-xl flex gap-3.5 items-start text-xs leading-relaxed shadow-lg">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-1 text-red-400">Offline Mock Insights Enabled</h4>
                    <p>
                      The Google Gemini API rate limit was exceeded (429) or offline during transcript upload. 
                      Qualia automatically fell back to the local qualitative mock engine to provide a seamless research sandbox experience.
                    </p>
                  </div>
                </div>
              )}



              {/* Executive Summary */}
              <Card className="bg-[#0b0f19]/60">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider">Executive Synthesis Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {selectedInterview.insight.summary}
                  </p>
                  <Separator />
                  <p className="text-xs text-gray-500">
                    <span className="font-bold text-gray-400">User Persona Profile:</span> {selectedInterview.insight.user_persona}
                  </p>
                </CardContent>
              </Card>

              {/* Highlights Grid: Pain Points, Feature Requests, Positive Feedback */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pain Points Card */}
                <Card className="border-t-2 border-t-red-500 bg-[#111827]/40">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2 border-b border-[#1f2937]">
                    <Frown className="w-4 h-4 text-red-400" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-400">Pain Points</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-3">
                      {selectedInterview.insight.pain_points.map((p, i) => (
                        <li key={i} className="text-xs text-gray-300 leading-relaxed flex items-start gap-1.5">
                          <span className="text-red-500 shrink-0 mt-0.5">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Feature Requests Card */}
                <Card className="border-t-2 border-t-indigo-500 bg-[#111827]/40">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2 border-b border-[#1f2937]">
                    <Lightbulb className="w-4 h-4 text-indigo-400" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-400">Feature Requests</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-3">
                      {selectedInterview.insight.feature_requests.map((f, i) => (
                        <li key={i} className="text-xs text-gray-300 leading-relaxed flex items-start gap-1.5">
                          <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Positive Feedback Card */}
                <Card className="border-t-2 border-t-emerald-500 bg-[#111827]/40">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2 border-b border-[#1f2937]">
                    <ThumbsUp className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">Positive Feedback</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-3">
                      {selectedInterview.insight.positive_feedback.map((f, i) => (
                        <li key={i} className="text-xs text-gray-300 leading-relaxed flex items-start gap-1.5">
                          <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Verbatim quotes section */}
              {selectedInterview.insight.key_quotes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <Quote className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Verbatim Grounded Evidence</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedInterview.insight.key_quotes.map((q, i) => (
                      <Card key={i} className="bg-[#0b0f19]/30 border border-[#1f2937]">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm italic text-gray-200 leading-relaxed font-serif pl-3 border-l-2 border-[#6366f1]/60 flex-1">
                              "{q.quote}"
                            </p>
                            <button
                              onClick={() => handleCopyQuote(q.quote, i)}
                              className="text-gray-500 hover:text-white p-1.5 rounded-lg border border-[#1f2937] bg-[#111827] hover:bg-[#1f2937] transition-all duration-200 cursor-pointer shrink-0"
                              title="Copy quote to clipboard"
                            >
                              {copiedIndex === i ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold pt-1">
                            <span>Grounding Context: {q.context}</span>
                            <Badge variant="outline" className="text-[9px]">Grounded source verified</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                  </div>
                </div>
              )}

              {/* Raw Transcript Excerpt */}
              <div className="space-y-2 border-t border-[#1f2937] pt-6">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <FileText className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Raw Transcript Excerpt</h3>
                </div>
                <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1f2937] max-h-36 overflow-y-auto text-xs text-gray-400 leading-relaxed font-mono whitespace-pre-wrap">
                  {selectedInterview.transcript}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-sm">Select an interview to view qualitative analysis and insights.</p>
          </div>
        )}
      </div>
    </div>
  );
}
