"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock,
  User, Video, Phone, MapPin, CheckCircle, AlertCircle, X, Edit3,
  Bell, Repeat, Filter, Grid3x3, List, Settings, RefreshCw,
  MoreHorizontal, Circle, Users, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionsAPI } from "@/lib/api";

type CalendarView = "month" | "week" | "day" | "list";
type SessionType = "video" | "phone" | "in_person" | "group";
type SessionStatus = "scheduled" | "completed" | "cancelled" | "no_show" | "in_progress";

interface CalendarEvent {
  id: string;
  patient_name: string;
  patient_initials: string;
  start_time: string;
  end_time: string;
  date: string; // YYYY-MM-DD
  day_of_week: number; // 0=Sun
  hour: number; // 0-23 start hour
  duration_mins: number;
  type: SessionType;
  status: SessionStatus;
  session_number?: number;
  is_intake?: boolean;
  notes?: string;
  color: string;
}

// Dec 2024 calendar data
const TODAY = new Date(2024, 11, 23); // Dec 23 2024
const CURRENT_MONTH = 11; // December
const CURRENT_YEAR = 2024;

const EVENTS: CalendarEvent[] = [
  { id: "e1", patient_name: "Sarah M.", patient_initials: "SM", start_time: "10:00 AM", end_time: "10:50 AM", date: "2024-12-23", day_of_week: 1, hour: 10, duration_mins: 50, type: "video", status: "scheduled", session_number: 8, color: "bg-blue-500" },
  { id: "e2", patient_name: "James K.", patient_initials: "JK", start_time: "1:00 PM", end_time: "1:50 PM", date: "2024-12-23", day_of_week: 1, hour: 13, duration_mins: 50, type: "video", status: "scheduled", session_number: 3, color: "bg-violet-500" },
  { id: "e3", patient_name: "Maria L.", patient_initials: "ML", start_time: "3:00 PM", end_time: "3:50 PM", date: "2024-12-23", day_of_week: 1, hour: 15, duration_mins: 50, type: "phone", status: "scheduled", session_number: 12, color: "bg-orange-500" },
  { id: "e4", patient_name: "David R.", patient_initials: "DR", start_time: "11:00 AM", end_time: "11:50 AM", date: "2024-12-24", day_of_week: 2, hour: 11, duration_mins: 50, type: "in_person", status: "scheduled", session_number: 5, color: "bg-emerald-500" },
  { id: "e5", patient_name: "Emma T.", patient_initials: "ET", start_time: "2:00 PM", end_time: "2:50 PM", date: "2024-12-24", day_of_week: 2, hour: 14, duration_mins: 50, type: "video", status: "scheduled", is_intake: true, color: "bg-rose-500" },
  { id: "e6", patient_name: "Group: Anxiety Support", patient_initials: "GRP", start_time: "9:00 AM", end_time: "10:00 AM", date: "2024-12-26", day_of_week: 4, hour: 9, duration_mins: 60, type: "group", status: "scheduled", color: "bg-[#2EC4B6]" },
  { id: "e7", patient_name: "Sarah M.", patient_initials: "SM", start_time: "10:00 AM", end_time: "10:50 AM", date: "2024-12-30", day_of_week: 1, hour: 10, duration_mins: 50, type: "video", status: "scheduled", session_number: 9, color: "bg-blue-500" },
  { id: "e8", patient_name: "New Patient", patient_initials: "NP", start_time: "1:30 PM", end_time: "3:00 PM", date: "2024-12-30", day_of_week: 1, hour: 13, duration_mins: 90, type: "video", status: "scheduled", is_intake: true, color: "bg-rose-500" },
  { id: "e9", patient_name: "Maria L.", patient_initials: "ML", start_time: "10:00 AM", end_time: "10:50 AM", date: "2024-12-19", day_of_week: 4, hour: 10, duration_mins: 50, type: "phone", status: "completed", session_number: 11, color: "bg-orange-500" },
  { id: "e10", patient_name: "James K.", patient_initials: "JK", start_time: "2:00 PM", end_time: "2:50 PM", date: "2024-12-20", day_of_week: 5, hour: 14, duration_mins: 50, type: "video", status: "no_show", session_number: 2, color: "bg-violet-500" },
];

const STATUS_CONFIG: Record<SessionStatus, { label: string; dot: string }> = {
  scheduled: { label: "Scheduled", dot: "bg-blue-500" },
  completed: { label: "Completed", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", dot: "bg-gray-400" },
  no_show: { label: "No Show", dot: "bg-red-500" },
  in_progress: { label: "In Progress", dot: "bg-yellow-500" },
};

const TYPE_ICON: Record<SessionType, React.ElementType> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  group: Users,
};

// Build month calendar grid
function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Week hours for day/week view
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am-7pm

export default function CalendarPage() {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(TODAY);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(EVENTS);

  const fetchEvents = useCallback(async () => {
    const d = currentDate;
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    try {
      const data = await sessionsAPI.list({ date_from: start, date_to: end, limit: 100 } as any);
      const items = Array.isArray(data) ? data : (data as any)?.data ?? [];
      if (items.length > 0) {
        setEvents(items.map((s: any) => ({
          id: s.id,
          date: s.scheduled_at ? s.scheduled_at.split('T')[0] : '',
          time: s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00',
          duration: s.duration_minutes || 50,
          patient_name: s.patient_name || 'Patient',
          type: s.session_type || 'individual',
          status: s.status || 'scheduled',
          format: s.format || 'video',
          color: s.status === 'completed' ? 'green' : s.status === 'cancelled' ? 'red' : 'blue',
        })));
      }
    } catch {
      // keep static events as fallback
    }
  }, [currentDate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const monthGrid = buildMonthGrid(currentDate.getFullYear(), currentDate.getMonth());

  const eventsForDate = (dateStr: string) =>
    events.filter((e) => e.date === dateStr);

  const formatDateStr = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Week view: current week Mon-Sun
  const getWeekDates = () => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  };
  const weekDates = getWeekDates();

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date(TODAY));

  const headerLabel = () => {
    if (view === "month") return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "week") {
      const start = weekDates[0];
      const end = weekDates[6];
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${DAY_NAMES[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}`;
  };

  const todayDateStr = formatDateStr(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#0A2342]" />
          <h1 className="font-bold text-[#0A2342] text-lg">Calendar</h1>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <button onClick={navigatePrev} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={navigateNext} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 px-2 text-sm">{headerLabel()}</span>
          <button
            onClick={goToday}
            className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-400 ml-2"
          >
            Today
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["month","week","day","list"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize",
                  view === v ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
              router.push(`/sessions/new?date=${dateStr}`);
            }}
            className="bg-[#0A2342] hover:bg-[#0d2d56] text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6 text-sm flex-shrink-0">
        {[
          { label: "This Week", value: "5 sessions" },
          { label: "Today", value: "3 sessions" },
          { label: "Pending Notes", value: "2", color: "text-orange-600" },
          { label: "Upcoming Intakes", value: "2" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-gray-400">{s.label}</span>
            <span className={cn("font-semibold text-gray-800", s.color)}>{s.value}</span>
          </div>
        ))}
        <button className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Sync
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Content */}
        <div className="flex-1 overflow-auto">

          {/* MONTH VIEW */}
          {view === "month" && (
            <div className="p-4">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-3">{d}</div>
                  ))}
                </div>
                {/* Days grid */}
                <div className="grid grid-cols-7">
                  {monthGrid.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />;
                    }
                    const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayEvents = eventsForDate(dateStr);
                    const isToday = dateStr === todayDateStr;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    return (
                      <div
                        key={day}
                        className={cn(
                          "min-h-[100px] border-b border-r border-gray-100 p-2 cursor-pointer hover:bg-blue-50/30 transition-colors",
                          isWeekend && "bg-gray-50/50"
                        )}
                      >
                        <div className={cn(
                          "text-sm font-medium mb-1.5 w-7 h-7 flex items-center justify-center rounded-full",
                          isToday ? "bg-[#0A2342] text-white" : "text-gray-700"
                        )}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((evt) => {
                            const TypeIcon = TYPE_ICON[evt.type];
                            return (
                              <div
                                key={evt.id}
                                onClick={() => setSelectedEvent(evt)}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded-md text-white truncate flex items-center gap-1 cursor-pointer",
                                  evt.color,
                                  evt.status === "completed" && "opacity-60",
                                  evt.status === "no_show" && "opacity-40 line-through"
                                )}
                              >
                                <TypeIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{evt.start_time.replace(" AM","").replace(" PM","")} {evt.patient_name.split(" ")[0]}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {view === "week" && (
            <div className="flex flex-col h-full">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="py-3 px-2" />
                {weekDates.map((date) => {
                  const dateStr = formatDateStr(date.getFullYear(), date.getMonth(), date.getDate());
                  const isToday = dateStr === todayDateStr;
                  const dayEvents = eventsForDate(dateStr);
                  return (
                    <div key={dateStr} className="py-3 text-center border-l border-gray-100">
                      <div className="text-xs text-gray-400">{DAY_NAMES[date.getDay()]}</div>
                      <div className={cn(
                        "text-lg font-bold mt-0.5 w-9 h-9 flex items-center justify-center rounded-full mx-auto",
                        isToday ? "bg-[#0A2342] text-white" : "text-gray-700"
                      )}>
                        {date.getDate()}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 justify-center mt-1">
                          {dayEvents.slice(0, 3).map((e) => (
                            <div key={e.id} className={cn("w-1.5 h-1.5 rounded-full", e.color)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-8">
                  {/* Hours column */}
                  <div>
                    {HOURS.map((h) => (
                      <div key={h} className="h-16 border-b border-gray-100 px-2 flex items-start pt-1">
                        <span className="text-xs text-gray-400">{h > 12 ? `${h-12}PM` : h === 12 ? "12PM" : `${h}AM`}</span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDates.map((date) => {
                    const dateStr = formatDateStr(date.getFullYear(), date.getMonth(), date.getDate());
                    const dayEvents = eventsForDate(dateStr);
                    const isToday = dateStr === todayDateStr;
                    return (
                      <div
                        key={dateStr}
                        className={cn("relative border-l border-gray-100", isToday && "bg-blue-50/20")}
                      >
                        {HOURS.map((h) => (
                          <div key={h} className="h-16 border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer" />
                        ))}
                        {dayEvents.map((evt) => {
                          const hourOffset = evt.hour - 8;
                          if (hourOffset < 0 || hourOffset >= HOURS.length) return null;
                          const TypeIcon = TYPE_ICON[evt.type];
                          return (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              style={{
                                position: "absolute",
                                top: `${hourOffset * 64 + 4}px`,
                                left: 4,
                                right: 4,
                                height: `${(evt.duration_mins / 60) * 64 - 8}px`,
                              }}
                              className={cn(
                                "rounded-lg px-2 py-1 text-white cursor-pointer hover:opacity-90 overflow-hidden z-10",
                                evt.color,
                                evt.status === "completed" && "opacity-60",
                                evt.status === "no_show" && "opacity-30"
                              )}
                            >
                              <div className="text-xs font-semibold truncate flex items-center gap-1">
                                <TypeIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                {evt.patient_name.split(" ")[0]}
                              </div>
                              <div className="text-[10px] opacity-80">{evt.start_time}</div>
                              {evt.is_intake && (
                                <div className="text-[10px] bg-white/20 rounded px-1 mt-0.5 inline-block">Intake</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {view === "list" && (
            <div className="p-6">
              <div className="space-y-6">
                {["2024-12-23","2024-12-24","2024-12-26","2024-12-30"].map((dateStr) => {
                  const dayEvents = eventsForDate(dateStr);
                  if (dayEvents.length === 0) return null;
                  const date = new Date(dateStr + "T00:00:00");
                  const isToday = dateStr === todayDateStr;
                  return (
                    <div key={dateStr}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                          isToday ? "bg-[#0A2342] text-white" : "bg-gray-100 text-gray-700"
                        )}>
                          {date.getDate()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">
                            {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
                          </div>
                          <div className="text-xs text-gray-400">{DAY_NAMES[date.getDay()]} · {dayEvents.length} session{dayEvents.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <div className="space-y-2 ml-13 pl-4 border-l-2 border-gray-100">
                        {dayEvents.sort((a,b) => a.hour - b.hour).map((evt) => {
                          const TypeIcon = TYPE_ICON[evt.type];
                          const statusCfg = STATUS_CONFIG[evt.status];
                          return (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#2EC4B6] hover:shadow-sm transition-all cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold", evt.color)}>
                                    {evt.patient_initials}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900 text-sm">
                                      {evt.patient_name}
                                      {evt.is_intake && <span className="ml-2 text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Intake</span>}
                                      {evt.session_number && <span className="ml-2 text-xs text-gray-400">Session #{evt.session_number}</span>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {evt.start_time} – {evt.end_time}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <TypeIcon className="w-3 h-3" />
                                        {evt.type === "video" ? "Video" : evt.type === "phone" ? "Phone" : evt.type === "group" ? "Group" : "In-Person"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 text-xs">
                                    <div className={cn("w-2 h-2 rounded-full", statusCfg.dot)} />
                                    <span className="text-gray-500">{statusCfg.label}</span>
                                  </div>
                                  {evt.status === "scheduled" && (
                                    <a
                                      href={`/sessions/prepare`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="bg-[#0A2342] text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-[#0d2d56]"
                                    >
                                      Prepare
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {view === "day" && (
            <div className="flex flex-col h-full">
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
                <div className="font-bold text-gray-800">
                  {DAY_NAMES[currentDate.getDay()]}, {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getDate()}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-[80px_1fr]">
                  {HOURS.map((h) => {
                    const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    const hourEvents = eventsForDate(dateStr).filter((e) => e.hour === h);
                    return (
                      <>
                        <div key={`h-${h}`} className="h-20 border-b border-gray-100 px-2 flex items-start pt-2">
                          <span className="text-xs text-gray-400">{h > 12 ? `${h-12}:00 PM` : h === 12 ? "12:00 PM" : `${h}:00 AM`}</span>
                        </div>
                        <div key={`c-${h}`} className="h-20 border-b border-gray-100 border-l border-gray-200 relative px-2 py-1">
                          {hourEvents.map((evt) => {
                            const TypeIcon = TYPE_ICON[evt.type];
                            return (
                              <div
                                key={evt.id}
                                onClick={() => setSelectedEvent(evt)}
                                className={cn("rounded-xl px-3 py-2 text-white cursor-pointer hover:opacity-90 flex items-center gap-3", evt.color)}
                              >
                                <TypeIcon className="w-4 h-4 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-sm">{evt.patient_name}</div>
                                  <div className="text-xs opacity-80">{evt.start_time} – {evt.end_time} · {evt.duration_mins} min</div>
                                </div>
                                {evt.is_intake && (
                                  <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-lg">Intake</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mini sidebar for upcoming */}
        <div className="w-64 border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0 hidden lg:block">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Upcoming Today</h3>
          </div>
          <div className="p-3 space-y-2">
            {eventsForDate(todayDateStr).sort((a,b) => a.hour - b.hour).map((evt) => {
              const TypeIcon = TYPE_ICON[evt.type];
              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className="p-3 rounded-xl border border-gray-100 hover:border-[#2EC4B6] cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0", evt.color)}>
                      {evt.patient_initials}
                    </div>
                    <span className="text-xs font-semibold text-gray-800 truncate">{evt.patient_name.split(" ")[0]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{evt.start_time}</span>
                    <TypeIcon className="w-3 h-3 ml-auto" />
                  </div>
                </div>
              );
            })}
            {eventsForDate(todayDateStr).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No sessions today</p>
            )}
          </div>
          <div className="p-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Availability</h3>
            {[
              { day: "Mon", slots: 3 },
              { day: "Tue", slots: 4 },
              { day: "Wed", slots: 2 },
              { day: "Thu", slots: 5 },
              { day: "Fri", slots: 3 },
            ].map((a) => (
              <div key={a.day} className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500">{a.day}</span>
                <div className="flex gap-1">
                  {Array.from({ length: a.slots }).map((_, i) => (
                    <div key={i} className="w-2 h-2 bg-[#2EC4B6] rounded-full" />
                  ))}
                </div>
              </div>
            ))}
            <button className="w-full mt-2 text-xs text-[#2EC4B6] border border-[#2EC4B6] rounded-lg py-1.5 hover:bg-[#2EC4B6]/5 transition-colors">
              Edit Availability
            </button>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold", selectedEvent.color)}>
                  {selectedEvent.patient_initials}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selectedEvent.patient_name}</h2>
                  <div className="text-sm text-gray-500">
                    {selectedEvent.is_intake ? "Intake Session" : `Session #${selectedEvent.session_number || ""}`}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { icon: Clock, label: `${selectedEvent.start_time} – ${selectedEvent.end_time} (${selectedEvent.duration_mins} min)` },
                { icon: CalendarIcon, label: new Date(selectedEvent.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) },
                { icon: TYPE_ICON[selectedEvent.type], label: selectedEvent.type === "video" ? "Video Session" : selectedEvent.type === "phone" ? "Phone Session" : selectedEvent.type === "group" ? "Group Session" : "In-Person" },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    {item.label}
                  </div>
                );
              })}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Circle className="w-3.5 h-3.5" style={{ fill: "", color: "#666" }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[selectedEvent.status].dot)} />
                  <span className="text-gray-600">{STATUS_CONFIG[selectedEvent.status].label}</span>
                </div>
              </div>
            </div>

            {selectedEvent.status === "scheduled" && (
              <div className="flex gap-2">
                <a
                  href={`/sessions/prepare`}
                  className="flex-1 bg-[#0A2342] hover:bg-[#0d2d56] text-white py-2.5 rounded-xl text-sm font-semibold text-center"
                >
                  Prepare
                </a>
                <a
                  href={`/sessions/room`}
                  className="flex-1 bg-[#2EC4B6] hover:bg-[#26b0a3] text-white py-2.5 rounded-xl text-sm font-semibold text-center"
                >
                  Start Session
                </a>
                <button className="px-3 border border-gray-300 rounded-xl hover:border-gray-400">
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
            {selectedEvent.status === "completed" && (
              <Link href="/notes" className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold text-center block">
                View Session Notes
              </Link>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
