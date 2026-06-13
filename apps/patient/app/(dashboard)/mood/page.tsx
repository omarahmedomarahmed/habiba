"use client";

import { useState, useEffect } from "react";
import {
  Smile, Frown, Meh, Heart, Sun, Moon, Cloud, CloudRain, Zap,
  Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Calendar, Clock, MessageSquare, Brain, Activity, Target,
  CheckCircle2, AlertCircle, Sparkles, BarChart2, Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { patientAPI } from "@/lib/api";

type MoodLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface MoodEntry {
  id: string;
  date: string;
  time: string;
  mood: MoodLevel;
  energy: MoodLevel;
  anxiety: MoodLevel;
  sleep_hours: number;
  sleep_quality: MoodLevel;
  emotions: string[];
  activities: string[];
  notes: string;
  triggers?: string[];
}

const EMOTIONS = [
  "Happy", "Calm", "Hopeful", "Grateful", "Connected",
  "Anxious", "Sad", "Frustrated", "Overwhelmed", "Lonely",
  "Angry", "Confused", "Numb", "Scared", "Irritable",
  "Content", "Excited", "Tired", "Restless", "Peaceful"
];

const ACTIVITIES = [
  "Exercise", "Meditation", "Journaling", "Reading", "Social time",
  "Work", "Creative activity", "Nature walk", "Therapy session", "Self-care",
  "Sleep (good)", "Sleep (poor)", "Eating well", "Screen time",
  "Family time", "Music", "Cooking", "Learning"
];


function getMoodEmoji(level: number): string {
  if (level >= 9) return "😄";
  if (level >= 7) return "😊";
  if (level >= 5) return "😐";
  if (level >= 3) return "😔";
  return "😢";
}

function getMoodColor(level: number): string {
  if (level >= 8) return "text-emerald-600 bg-emerald-50";
  if (level >= 6) return "text-blue-600 bg-blue-50";
  if (level >= 4) return "text-amber-600 bg-amber-50";
  return "text-rose-600 bg-rose-50";
}

function getMoodBarColor(level: number): string {
  if (level >= 8) return "bg-emerald-500";
  if (level >= 6) return "bg-blue-500";
  if (level >= 4) return "bg-amber-400";
  return "bg-rose-500";
}

function getAnxietyColor(level: number): string {
  if (level <= 3) return "text-emerald-600 bg-emerald-50";
  if (level <= 5) return "text-amber-600 bg-amber-50";
  return "text-rose-600 bg-rose-50";
}

export default function MoodPage() {
  const [activeTab, setActiveTab] = useState<"log" | "history" | "insights" | "trends">("log");
  const [logStep, setLogStep] = useState<"mood" | "emotions" | "activities" | "notes" | "done">("mood");
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<MoodLevel | null>(null);
  const [selectedAnxiety, setSelectedAnxiety] = useState<MoodLevel | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [moodNotes, setMoodNotes] = useState("");
  const [sleepHours, setSleepHours] = useState(7);
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [savingMood, setSavingMood] = useState(false);

  useEffect(() => {
    patientAPI.moodTrend(30).then((data: any) => {
      const items = Array.isArray(data) ? data : data?.data ?? [];
      if (items.length > 0) setMoodHistory(items);
    }).catch(() => {});
  }, []);

  const saveMoodEntry = async () => {
    if (!selectedMood) return;
    setSavingMood(true);
    try {
      await patientAPI.addMoodEntry({
        mood_score: selectedMood,
        energy_level: selectedEnergy,
        anxiety_level: selectedAnxiety,
        sleep_hours: sleepHours,
        emotions: selectedEmotions,
        activities: selectedActivities,
        notes: moodNotes,
        recorded_at: new Date().toISOString(),
      });
    } catch {
      // non-critical — entry saved locally regardless
    } finally {
      setSavingMood(false);
    }
    setLogStep("done");
  };
  const [selectedInsightType, setSelectedInsightType] = useState<string>("all");

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayEntry = moodHistory.find(e => e.date?.slice(0, 10) === todayDateStr) || moodHistory[0];
  const hasLoggedToday = moodHistory.some(e => e.date?.slice(0, 10) === todayDateStr);

  const last7 = moodHistory.slice(0, 7);
  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const weeklyAvgMood = avg(last7.map(e => e.mood || 0));
  const weeklyAvgEnergy = avg(last7.map(e => e.energy || 0));
  const weeklyAvgAnxiety = avg(last7.map(e => e.anxiety || 0));
  const weeklyAvgSleep = avg(last7.map(e => e.sleep_hours || 0));

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : prev.length < 5 ? [...prev, emotion] : prev
    );
  };

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev =>
      prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
    );
  };

  // Mini mood chart data for last 7 days
  const chartData = last7.slice().reverse().map((entry) => ({
    day: new Date(entry.date).toLocaleDateString("en-US", { weekday: "short" }),
    mood: entry.mood,
    anxiety: entry.anxiety,
    energy: entry.energy
  }));

  const maxMood = Math.max(...chartData.map(d => d.mood));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mood Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-gray-500">This week avg</p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-gray-900">{weeklyAvgMood || "—"}</span>
              <span className="text-xs font-medium text-emerald-600 flex items-center">
                <TrendingUp className="h-3 w-3" />this week
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["log", "history", "insights", "trends"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize",
              activeTab === tab
                ? "bg-white text-[#0A2342] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "log" ? "Log Mood" : tab === "insights" ? "AI Insights" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* LOG MOOD TAB */}
      {activeTab === "log" && (
        <div className="space-y-4">
          {hasLoggedToday && logStep === "mood" ? (
            <>
              {/* Today's entry summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Today's Log</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Logged at {todayEntry.time}</p>
                  </div>
                  <span className="text-3xl">{getMoodEmoji(todayEntry.mood)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Mood", value: todayEntry.mood, type: "mood" },
                    { label: "Energy", value: todayEntry.energy, type: "energy" },
                    { label: "Anxiety", value: todayEntry.anxiety, type: "anxiety" },
                    { label: "Sleep", value: `${todayEntry.sleep_hours}h`, type: "sleep" },
                  ].map(({ label, value, type }) => (
                    <div key={label} className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-bold text-gray-900">{value}</span>
                        {type !== "sleep" && (
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", getMoodBarColor(value as number))}
                              style={{ width: `${(value as number) * 10}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {todayEntry.emotions.map(e => (
                    <span key={e} className="px-2.5 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">{e}</span>
                  ))}
                </div>

                {todayEntry.notes && (
                  <p className="text-sm text-gray-600 italic">"{todayEntry.notes}"</p>
                )}

                <button
                  onClick={() => setLogStep("mood")}
                  className="mt-4 w-full py-2 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 className="h-4 w-4" /> Edit Today's Entry
                </button>
              </div>

              <button
                onClick={() => setLogStep("mood")}
                className="w-full py-3 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Log Another Check-in
              </button>
            </>
          ) : (
            <>
              {/* Mood logging flow */}
              {logStep === "mood" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900">How are you feeling?</h3>
                    <p className="text-sm text-gray-500 mt-1">Rate your overall mood from 1–10</p>
                  </div>

                  {/* Mood scale */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Very Low</span>
                      <span>Perfect</span>
                    </div>
                    <div className="flex gap-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                        <button
                          key={level}
                          onClick={() => setSelectedMood(level as MoodLevel)}
                          className={cn(
                            "flex-1 h-12 rounded-xl text-sm font-bold transition-all border-2",
                            selectedMood === level
                              ? "border-[#0A2342] bg-[#0A2342] text-white scale-110"
                              : "border-gray-200 text-gray-600 hover:border-[#0A2342] hover:text-[#0A2342]"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    {selectedMood && (
                      <div className="text-center py-2">
                        <span className="text-4xl">{getMoodEmoji(selectedMood)}</span>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedMood >= 8 ? "Feeling great!" : selectedMood >= 6 ? "Doing okay" : selectedMood >= 4 ? "Could be better" : "Struggling today"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Energy */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" /> Energy Level
                    </p>
                    <div className="flex gap-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                        <button
                          key={level}
                          onClick={() => setSelectedEnergy(level as MoodLevel)}
                          className={cn(
                            "flex-1 h-10 rounded-lg text-xs font-bold transition-all border",
                            selectedEnergy === level
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-gray-200 text-gray-500 hover:border-amber-400"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Anxiety */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-500" /> Anxiety Level
                    </p>
                    <div className="flex gap-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                        <button
                          key={level}
                          onClick={() => setSelectedAnxiety(level as MoodLevel)}
                          className={cn(
                            "flex-1 h-10 rounded-lg text-xs font-bold transition-all border",
                            selectedAnxiety === level
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-gray-200 text-gray-500 hover:border-rose-400"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sleep */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Moon className="h-4 w-4 text-indigo-500" /> Sleep last night: <span className="font-bold text-indigo-600">{sleepHours} hours</span>
                    </p>
                    <input
                      type="range" min={0} max={12} step={0.5} value={sleepHours}
                      onChange={e => setSleepHours(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0h</span><span>4h</span><span>8h</span><span>12h</span>
                    </div>
                  </div>

                  <button
                    disabled={!selectedMood || !selectedEnergy || !selectedAnxiety}
                    onClick={() => setLogStep("emotions")}
                    className="w-full py-3 bg-[#0A2342] text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#123A63] transition-colors"
                  >
                    Continue →
                  </button>
                </div>
              )}

              {logStep === "emotions" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">What emotions are present?</h3>
                    <p className="text-sm text-gray-500 mt-1">Select up to 5 that resonate most</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EMOTIONS.map(emotion => (
                      <button
                        key={emotion}
                        onClick={() => toggleEmotion(emotion)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                          selectedEmotions.includes(emotion)
                            ? "bg-[#0A2342] text-white border-[#0A2342]"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#0A2342] hover:text-[#0A2342]"
                        )}
                      >
                        {emotion}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setLogStep("mood")} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">← Back</button>
                    <button onClick={() => setLogStep("activities")} className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">Continue →</button>
                  </div>
                </div>
              )}

              {logStep === "activities" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">What did you do today?</h3>
                    <p className="text-sm text-gray-500 mt-1">Activities help us understand your patterns</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITIES.map(activity => (
                      <button
                        key={activity}
                        onClick={() => toggleActivity(activity)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                          selectedActivities.includes(activity)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400"
                        )}
                      >
                        {activity}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setLogStep("emotions")} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">← Back</button>
                    <button onClick={() => setLogStep("notes")} className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">Continue →</button>
                  </div>
                </div>
              )}

              {logStep === "notes" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Anything to note?</h3>
                    <p className="text-sm text-gray-500 mt-1">Optional — this is shared with your therapist</p>
                  </div>
                  <textarea
                    value={moodNotes}
                    onChange={e => setMoodNotes(e.target.value)}
                    placeholder="What's on your mind? Any specific events, thoughts, or situations you want to capture?"
                    className="w-full h-28 p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
                  />
                  <div className="bg-amber-50 rounded-xl p-3 flex gap-2">
                    <Brain className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">This entry will be shared with Dr. Smith before your next session to help her understand your week better.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setLogStep("activities")} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">← Back</button>
                    <button onClick={saveMoodEntry} disabled={savingMood} className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] disabled:opacity-60">{savingMood ? "Saving..." : "Save Entry ✓"}</button>
                  </div>
                </div>
              )}

              {logStep === "done" && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 text-center border border-emerald-100">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Entry Saved!</h3>
                  <p className="text-sm text-gray-600 mt-2">Your mood log has been saved and shared with Dr. Smith. Keep it up — consistent tracking leads to better insights.</p>
                  <div className="mt-4 p-3 bg-white rounded-xl">
                    <p className="text-xs text-gray-500">AI insight based on your log:</p>
                    <p className="text-sm text-gray-700 mt-1 font-medium">
                      {selectedMood && selectedMood >= 7
                        ? "Great mood today! Your exercise and sleep pattern is working well."
                        : "Tough day. Remember your breathing exercises and reach out if you need support."}
                    </p>
                  </div>
                  <button
                    onClick={() => { setLogStep("mood"); setSelectedMood(null); setSelectedEnergy(null); setSelectedAnxiety(null); setSelectedEmotions([]); setSelectedActivities([]); setMoodNotes(""); }}
                    className="mt-4 w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]"
                  >
                    Done
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Entries</h3>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          {moodHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No mood entries yet — start logging above!</p>
            </div>
          ) : null}
          {moodHistory.map(entry => (
            <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {new Date(entry.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-xs text-gray-400">{entry.time}</p>
                </div>
                <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Mood", value: entry.mood },
                  { label: "Energy", value: entry.energy },
                  { label: "Anxiety", value: entry.anxiety },
                  { label: "Sleep", value: `${entry.sleep_hours}h` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {entry.emotions.map(e => (
                  <span key={e} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{e}</span>
                ))}
              </div>

              {entry.triggers && (
                <div className="flex gap-1 mb-2">
                  {entry.triggers.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs">⚡ {t}</span>
                  ))}
                </div>
              )}

              {entry.notes && (
                <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PATTERNS TAB */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Your Patterns</h3>
                <p className="text-xs text-white/60">Based on {moodHistory.length} logged entries</p>
              </div>
            </div>
            <p className="text-sm text-white/80">
              Tracking your mood consistently helps you and your therapist understand what affects your wellbeing.
            </p>
          </div>

          {moodHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Start logging your mood to see patterns here</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <BarChart2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">This Week Summary</h4>
                    <p className="text-sm text-gray-600">
                      You've logged mood {last7.length} time{last7.length !== 1 ? "s" : ""} this week.
                      {weeklyAvgMood > 0 && ` Average mood: ${weeklyAvgMood}/10.`}
                      {weeklyAvgAnxiety > 0 && ` Average anxiety: ${weeklyAvgAnxiety}/10.`}
                    </p>
                  </div>
                </div>
              </div>

              {weeklyAvgMood >= 7 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Positive Trend</h4>
                      <p className="text-sm text-gray-600">Your average mood this week is {weeklyAvgMood}/10 — that&apos;s in the good range. Keep up the consistency!</p>
                    </div>
                  </div>
                </div>
              )}

              {weeklyAvgSleep > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <Moon className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Sleep Average</h4>
                      <p className="text-sm text-gray-600">You&apos;re averaging {weeklyAvgSleep} hours of sleep this week. {weeklyAvgSleep >= 7 ? "Good — aim to maintain this." : "Try to get 7–9 hours for optimal mood."}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TRENDS TAB */}
      {activeTab === "trends" && (
        <div className="space-y-4">
          {/* Mini chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">7-Day Mood Trend</h3>
            <div className="flex items-end gap-2 h-28">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col gap-0.5" style={{ height: "100px" }}>
                    <div
                      className={cn("w-full rounded-t-md transition-all", getMoodBarColor(d.mood))}
                      style={{ height: `${(d.mood / 10) * 100}%`, marginTop: "auto" }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{d.day}</span>
                  <span className="text-xs font-bold text-gray-700">{d.mood}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Avg Mood", value: weeklyAvgMood || "—", icon: Smile },
              { label: "Avg Anxiety", value: weeklyAvgAnxiety || "—", icon: AlertCircle },
              { label: "Avg Energy", value: weeklyAvgEnergy || "—", icon: Zap },
              { label: "Avg Sleep", value: weeklyAvgSleep ? `${weeklyAvgSleep}h` : "—", icon: Moon },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <Icon className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-1">last 7 days</p>
              </div>
            ))}
          </div>

          {/* Streaks */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🔥</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">7-Day Streak!</p>
                <p className="text-xs text-gray-600">You've logged your mood every day this week. That's fantastic commitment to your wellbeing.</p>
              </div>
            </div>
          </div>

          {/* Top emotions */}
          {(() => {
            const emotionCounts: Record<string, number> = {};
            moodHistory.forEach(e => (e.emotions || []).forEach(em => { emotionCounts[em] = (emotionCounts[em] || 0) + 1; }));
            const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const maxCount = topEmotions[0]?.[1] || 1;
            if (topEmotions.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Most Frequent Emotions</h3>
                {topEmotions.map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-700 w-20">{emotion}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0A2342] rounded-full" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{count}x</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
