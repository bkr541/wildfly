import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Airplane01Icon,
  ArrowRight04Icon,
  Calendar03Icon,
  Home01Icon,
  Location01Icon,
  Notification01Icon,
  Search01Icon,
  UserAdd01Icon,
  UserGroupIcon,
  InformationCircleIcon,
  TicketStarIcon,
  DollarCircleIcon,
  AirplaneTakeOff01Icon,
  AirplaneLanding01Icon,
  CalendarCheckOut02Icon,
  CalendarCheckIn02Icon,
  CircleArrowReload01Icon,
  SunCloud01Icon,
  MapPinpoint01Icon,
  Cancel01Icon,
  SunriseIcon,
  Clock01Icon,
  CircleArrowRight02Icon
} from "@hugeicons/core-free-icons";

import { SplitFlapHeader } from "@/components/SplitFlapHeader";

import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppInput } from "@/components/ui/app-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const surfaceClass =
  "rounded-[28px] border border-[#E7ECEC] bg-white shadow-[0_18px_40px_rgba(21,41,40,0.08)]";

const sectionButtonClass =
  "shrink-0 rounded-full border border-[#D9E5E4] bg-white px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[#345C5A] transition-colors hover:border-[#10B981] hover:text-[#065F46]";

const auditRows = [
  {
    element: "Primary actions",
    standard: "Height, radius, font weight, icon spacing, hover state",
    note: "Keep one button language across auth, search, and cards.",
  },
  {
    element: "Inputs",
    standard: "48px min height, label style, focus line, helper/error copy",
    note: "Wildfly already has a custom AppInput pattern worth centralizing.",
  },
  {
    element: "Tabs",
    standard: "Active border, text weight, spacing, badge count treatment",
    note: "Friends uses tabs heavily, so this is a high-value consistency target.",
  },
  {
    element: "Cards",
    standard: "Top image treatment, chip placement, metric hierarchy, padding",
    note: "Flight and destination cards are the visual crown jewels.",
  },
  {
    element: "Icons",
    standard: "Stroke size, container size, neutral vs accent color usage",
    note: "Hugeicons already gives you a strong shared voice.",
  },
  {
    element: "Feedback",
    standard: "Badges, progress, skeletons, alerts, loading states",
    note: "These are easy to forget and easy to standardize.",
  },
];

const navSections = [
  ["tokens", "Tokens"],
  ["components", "Components"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["tabs", "Tabs"],
  ["cards", "Cards"],
  ["chips", "Chips & Badges"],
  ["feedback", "Feedback"],
] as const;

const colorTokens = [
  { name: "Background", varName: "--background", swatchClass: "bg-background" },
  { name: "Primary", varName: "--primary", swatchClass: "bg-primary" },
  { name: "Secondary", varName: "--secondary", swatchClass: "bg-secondary" },
  { name: "Card", varName: "--card", swatchClass: "bg-card" },
  { name: "Accent", varName: "--accent", swatchClass: "bg-accent" },
  { name: "Muted", varName: "--muted", swatchClass: "bg-muted" },
  { name: "Ring", varName: "--ring", swatchClass: "bg-[hsl(var(--ring))]" },
  { name: "Border", varName: "--border", swatchClass: "bg-[hsl(var(--border))]" },
];

function SectionShell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn(surfaceClass, "scroll-mt-24 overflow-hidden")}> 
      <div className="border-b border-[#EEF3F2] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#173433]">{title}</h2>
            <p className="mt-1 text-sm text-[#67807E]">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function ColorTokenSwatch({
  name,
  varName,
  swatchClass,
}: {
  name: string;
  varName: string;
  swatchClass: string;
}) {
  return (
    <div className="rounded-3xl border border-[#EEF2F1] bg-white p-4" style={{ boxShadow: "0 4px 20px rgba(53,92,90,0.06)" }}>
      <div className={cn("h-32 rounded-2xl w-full", swatchClass)} />
      <div className="mt-4 px-1">
        <p className="text-base font-bold text-[#173433]">{name}</p>
        <p className="text-[13px] tracking-[0.1em] text-[#8C9F9E] font-medium uppercase mt-0.5">{varName}</p>
      </div>
    </div>
  );
}

function IconChip({ icon, label }: { icon: any; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#D5E6E2] bg-[#F6FBFA] px-3 py-2 text-sm font-semibold text-[#2E4A4A]">
      <HugeiconsIcon icon={icon} size={18} />
      <span>{label}</span>
    </div>
  );
}

function PreviewDestinationCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#DFE7E6] bg-white shadow-[0_18px_40px_rgba(21,41,40,0.08)]">
      <div className="relative h-40 overflow-hidden bg-[linear-gradient(135deg,#285D67_0%,#3A8E86_55%,#A7F3D0_100%)] px-5 pb-4 pt-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <Badge className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-white/18">
            GO WILD
          </Badge>
          <Badge className="rounded-full bg-[#0F766E] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0F766E]">
            8 flights
          </Badge>
        </div>

        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-extrabold tracking-tight">ORD</p>
            <p className="text-sm font-medium text-white/85">Chicago, IL</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/75">Avg duration</p>
            <p className="text-sm font-semibold">2h 14m</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-[#F7FAFA] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#89A19F]">Price</p>
            <p className="mt-1 text-sm font-bold text-[#173433]">$212</p>
          </div>
          <div className="rounded-2xl bg-[#F7FAFA] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#89A19F]">Type</p>
            <p className="mt-1 text-sm font-bold text-[#173433]">Nonstop</p>
          </div>
          <div className="rounded-2xl bg-[#F7FAFA] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#89A19F]">Rating</p>
            <p className="mt-1 text-sm font-bold text-[#173433]">A+</p>
          </div>
        </div>

        <Button className="h-12 w-full rounded-2xl bg-[#10B981] text-white hover:bg-[#059669]">
          View Available Flights
        </Button>
      </div>
    </div>
  );
}

function PreviewDatePicker() {
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calendarCells = Array.from({ length: 35 }, (_, i) => i - 2); // Start some days before 1st to simulate offset

  return (
    <div className="rounded-3xl border border-[#EEF2F1] bg-white p-6 shadow-[0_4px_20px_rgba(53,92,90,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-[#E8EEEE] text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-xl font-bold text-[#2E4A4A]">November 2026</span>
        <button className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-[#E8EEEE] text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {days.map((d, i) => (
          <div key={d} className="flex items-center justify-center py-1">
            <span className={`text-[12px] font-medium ${i === 0 || i === 6 ? "text-red-400" : "text-[#9CA3AF]"}`}>{d}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum <= 0 || dayNum > 30) return <div key={idx} />;
          
          const isSelected = dayNum === 16;
          const isRange = dayNum > 16 && dayNum < 20;
          const isRangeEnd = dayNum === 20;
          
          let buttonStyle: React.CSSProperties = {};
          let textColor = "text-[#2E4A4A]";
          
          // Weekend red 
          if ((idx % 7 === 0 || idx % 7 === 6) && !isSelected && !isRange && !isRangeEnd) {
            textColor = "text-red-500";
          }
          
          if (isSelected || isRangeEnd) {
            buttonStyle = {
              background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
              border: "none",
              boxShadow: "0 2px 8px rgba(16,185,129,0.35)",
            };
            textColor = "text-white";
          } else if (isRange) {
            textColor = "text-[#059669]";
          }

          return (
            <div key={idx} className="relative flex items-center justify-center py-1">
              {(isRange || isRangeEnd) && dayNum !== 16 && idx % 7 !== 0 && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
              )}
              {isRange && idx % 7 !== 6 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
              )}
              {(isSelected) && dayNum === 16 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
              )}
              
              <button
                type="button"
                className={cn(
                  "relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  !isSelected && !isRangeEnd && !isRange && "hover:bg-[#F0FDF4]",
                  textColor
                )}
                style={buttonStyle}
              >
                {dayNum}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewMultiDestCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-[#E8EBEB]" style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}>
      {/* City photo */}
      <div className="relative h-[130px] overflow-hidden bg-[#C8D5D5]">
        <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)", opacity: 0.6 }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)" }} />
        <div className="absolute top-3 right-3 flex-shrink-0 rounded-lg px-2.5 py-1.5 flex items-center gap-1" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(232,235,235,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", backdropFilter: "blur(4px)" }}>
          <span className="text-[14px] font-black leading-none text-[#1A2E2E]">$212</span>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#10B981] rounded-full px-2.5 py-1">
          <HugeiconsIcon icon={TicketStarIcon} size={11} color="white" strokeWidth={2} />
          <span className="text-[10px] font-bold text-white leading-none">GO WILD</span>
        </div>
      </div>
      {/* Card body */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[18px] font-black text-[#1A2E2E] leading-tight flex-1 mr-2">
            <span className="text-[#10B981]">ORD</span>
            <span className="text-[#6B7B7B] font-normal text-[15px]"> | </span>
            Chicago<span className="text-[#6B7B7B] font-normal text-[16px]">, IL</span>
          </h3>
          <span className="text-[12px] text-[#6B7B7B] font-medium flex-shrink-0">8 Flights</span>
        </div>
        <div className="border-t border-[#F0F3F3] my-2.5" />
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                <HugeiconsIcon icon={DollarCircleIcon} size={13} color="#6B7B7B" strokeWidth={2} />
              </div>
              <span className="text-[12px] text-[#2E4A4A] truncate">Range: <span className="font-semibold">$212 – $450</span></span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                <HugeiconsIcon icon={SunriseIcon} size={13} color="#6B7B7B" strokeWidth={2} />
              </div>
              <span className="text-[12px] text-[#2E4A4A] truncate">Earliest: <span className="font-semibold">6:00 AM</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                <HugeiconsIcon icon={Clock01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
              </div>
              <span className="text-[12px] text-[#2E4A4A] truncate">Quickest: <span className="font-semibold">2h 14m</span></span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                <HugeiconsIcon icon={CircleArrowRight02Icon} size={13} color="#6B7B7B" strokeWidth={2} />
              </div>
              <span className="text-[12px] text-[#2E4A4A] truncate">Nonstop: <span className="font-semibold">3</span></span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button type="button" className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>View Flights</button>
        </div>
      </div>
    </div>
  );
}

function PreviewFlightDestCard() {
  return (
    <div
      className="flex flex-col rounded-2xl bg-white overflow-hidden transition-all duration-200 w-full border border-[#E8EBEB]"
      style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
    >
      <div className="text-left w-full px-4 pt-3.5 pb-3">
        {/* Row 1: Airline name + price badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-[18px] flex items-center text-[10px] font-bold text-[#2E4A4A] tracking-widest uppercase">Frontier</div>
          <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-[#D1FAE5] text-[#065F46]">
            $212
          </span>
        </div>

        {/* Row 2: Dep time — plane — Arr time */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">
            8:00 AM
          </span>
          <div className="flex-1 flex items-center gap-1 px-1">
            <div className="flex-1 h-px bg-[#C8D5D5]" />
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2E4A4A] shrink-0" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
            <div className="flex-1 h-px bg-[#C8D5D5]" />
          </div>
          <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">
            10:14 AM
          </span>
        </div>

        {/* Row 3: Origin city — duration pill — Dest city */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-[#6B7B7B] font-medium leading-tight">
            ORD, IL
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-0.5 rounded-full">
            2h 14m
          </span>
          <span className="text-[13px] text-[#6B7B7B] font-medium leading-tight text-right">
            MIA, FL
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewFlightSearchForm() {
  const ACTIVE_TRIP_FLEX = 1.7;
  const tripType = "round-trip";
  
  const tripOptions = [
    { value: "one-way", label: "One Way", icon: ArrowRight04Icon },
    { value: "round-trip", label: "Round Trip", icon: CircleArrowReload01Icon },
    { value: "day-trip", label: "Day Trip", icon: SunCloud01Icon },
    { value: "multi-day", label: "Multi Day", icon: MapPinpoint01Icon },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="relative flex items-stretch bg-white rounded-full p-0.5 border border-[#E8EBEB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] h-[44px]">
        <div
          className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
          style={{ background: "#10B981", width: `calc((100% - 4px) * ${ACTIVE_TRIP_FLEX} / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX})`, left: `calc(2px + (100% - 4px) * 1 / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX})` }}
        />
        {tripOptions.map((opt) => {
          const isActive = tripType === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              style={{ flex: isActive ? ACTIVE_TRIP_FLEX : 1 }}
              className={cn(
                "py-2.5 px-3 text-sm font-semibold rounded-full relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                isActive ? "text-white" : "text-[#9CA3AF]"
              )}
            >
              <HugeiconsIcon icon={opt.icon} size={18} color="currentColor" strokeWidth={2} className="shrink-0" />
              {isActive && <span className="whitespace-nowrap">{opt.label}</span>}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-2xl overflow-visible"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13)",
        }}
      >
        <div className="relative px-5 pt-5 pb-3">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure</label>
          <div className="app-input-container min-h-[48px] cursor-pointer">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <span className="app-input truncate flex-1 flex items-center text-[#1F2937]">ORD | Chicago, IL</span>
            <button type="button" className="app-input-reset app-input-reset--visible relative right-2">
              <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative px-5 pt-3 pb-3">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Arrival</label>
          <div className="app-input-container min-h-[48px] cursor-pointer">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={AirplaneLanding01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <span className="app-input truncate flex-1 flex items-center text-[#1F2937]">MIA | Miami, FL</span>
          </div>
        </div>

        <div className="px-5 pt-3 pb-0">
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure Date</label>
              <button type="button" className="app-input-container w-full text-left outline-none min-h-[48px]">
                <span className="app-input-icon-btn">
                  <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
                </span>
                <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base text-[#1F2937]">Mar 18, 2026</span>
              </button>
            </div>
            <div>
              <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Return Date</label>
              <button type="button" className="app-input-container w-full text-left outline-none min-h-[48px]">
                <span className="app-input-icon-btn">
                  <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
                </span>
                <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base text-[#6B7280]">Select date</span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 pt-5 pb-5">
            <label className="text-sm font-bold text-[#059669]">Search all destinations</label>
            <button className="relative inline-flex items-center h-5 w-9 shrink-0 rounded-full transition-colors duration-200 bg-[#E3E6E6]">
              <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [airport, setAirport] = useState("ATL");
  const [notes, setNotes] = useState("Consistent spacing makes the whole product feel more expensive.");
  const [searchMode, setSearchMode] = useState("one-way");
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [progress, setProgress] = useState(68);
  const [density, setDensity] = useState([16]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5 px-4 pb-24 pt-3 sm:px-5">
      <div
        className={cn(surfaceClass, "overflow-hidden") }
        style={{
          background:
            "radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #F8FBFB 100%)",
        }}
      >
        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-[#E7FFF5] px-3 py-1 text-[#047857] hover:bg-[#E7FFF5]">Centralized UI audit</Badge>
            <Badge variant="outline" className="rounded-full border-[#D6E4E2] text-[#486766]">
              shadcn + Tailwind + Hugeicons
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#D6E4E2] text-[#486766]">
              AppInput pattern included
            </Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-[28px] font-extrabold tracking-tight text-[#173433]">Wildfly design system audit page</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#587270]">
              This page is built to be your single visual pit stop for the load-bearing UI in Wildfly: text inputs,
              date selection, tabs, icons, badges, cards, feedback states, and app-specific flight surfaces.
            </p>
          </div>

          <Alert className="border-[#D8EFE6] bg-[#F4FFFA] text-[#173433]">
            <HugeiconsIcon icon={Notification01Icon} size={18} className="mt-0.5 text-[#059669]" />
            <AlertTitle>What to look for while reviewing</AlertTitle>
            <AlertDescription className="text-[#486766]">
              Compare radius, spacing, label tone, icon sizing, focus treatment, badge shape, and the hierarchy of primary vs.
              supporting information.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            {navSections.map(([id, label]) => (
              <button key={id} type="button" onClick={() => scrollToSection(id)} className={sectionButtonClass}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionShell
        id="tokens"
        title="Tokens, typography, and icon language"
        description="A quick read on color, hierarchy, and the visual voice already living in Wildfly."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {colorTokens.slice(0, 4).map((t) => (
              <ColorTokenSwatch key={t.varName} {...t} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {colorTokens.slice(4).map((t) => (
              <ColorTokenSwatch key={t.varName} {...t} />
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 mt-8">
            <div className="rounded-[24px] bg-[#F8FBFB] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7E9694]">Type scale</p>
              <div className="mt-4 space-y-3 text-[#173433]">
                <div>
                  <p className="text-[32px] font-extrabold tracking-tight">Display headline</p>
                  <p className="text-sm text-[#6C8583]">Use for top-of-screen messaging and hero cards.</p>
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tight">Section heading</p>
                  <p className="text-sm text-[#6C8583]">Use for card blocks and primary grouped content.</p>
                </div>
                <div>
                  <p className="text-base font-semibold">Card title / form label</p>
                  <p className="text-sm text-[#6C8583]">Use for the first scan within a component.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2E4A4A]">Body copy and helper text</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#93A8A7]">Caption / metadata</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#F8FBFB] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7E9694]">Icons in the current app voice</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <IconChip icon={Home01Icon} label="Home" />
                <IconChip icon={Airplane01Icon} label="Flights" />
                <IconChip icon={Location01Icon} label="Destinations" />
                <IconChip icon={Calendar03Icon} label="Dates" />
                <IconChip icon={UserGroupIcon} label="Friends" />
                <IconChip icon={Search01Icon} label="Search" />
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="buttons"
        title="Buttons & Actions"
        description="Exact production button styles used across Wildfly components."
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[24px] border-[#E8EEEE] shadow-none">
              <CardHeader>
                <CardTitle className="text-[#173433]">Production Auth Button</CardTitle>
                <CardDescription>Primary CTA from AuthUser.tsx</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6"
                >
                  <span className="text-center uppercase tracking-[0.35em]">
                    Sign Up
                  </span>
                  <HugeiconsIcon
                    icon={UserAdd01Icon}
                    size={18}
                    color="white"
                    strokeWidth={2}
                  />
                </button>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-[#E8EEEE] shadow-none">
              <CardHeader>
                <CardTitle className="text-[#173433]">Flight Search Button</CardTitle>
                <CardDescription>Search trigger from Flights.tsx</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  className="w-full h-14 rounded-full text-white text-base font-black uppercase tracking-[0.45em] flex items-center justify-center gap-2.5 shadow-[0_8px_20px_rgba(5,150,105,0.25)] hover:shadow-[0_12px_24px_rgba(5,150,105,0.35)] active:scale-[0.98] transition-all"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" }}
                >
                  <HugeiconsIcon icon={ArrowRight04Icon} size={22} color="white" strokeWidth={2} />
                  Let's Fly
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="components"
        title="Components (Date Picker)"
        description="Custom inline calendar giving a fixed visual ruler for spacing, typography, and selected-state color."
      >
        <div className="max-w-md">
          <PreviewDatePicker />
        </div>
      </SectionShell>

      <SectionShell
        id="forms"
        title="Flight Search Forms"
        description="The exact flight search input controls from Flights.tsx."
      >
        <div className="max-w-xl mx-auto">
          <PreviewFlightSearchForm />
        </div>
      </SectionShell>

      <SectionShell
        id="tabs"
        title="Tabs, date selection, and grouped navigation"
        description="Great for comparing active states, border treatments, and section padding without opening three different screens."
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="rounded-[24px] bg-[#F8FBFB] p-4 h-full">
              <p className="text-sm font-semibold text-[#173433] mb-3">Production FlightDestResults Tabs</p>
              <div className="relative z-10 flex items-center justify-around bg-white px-3 border-b border-gray-200 rounded-lg">
                <button className="flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-[30%] transition-colors relative text-gray-400 hover:text-gray-600 font-semibold">
                  <HugeiconsIcon icon={InformationCircleIcon} size={15} strokeWidth={1.5} />
                  Info
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-[30%] transition-colors relative text-[#10B981] font-bold">
                  <HugeiconsIcon icon={Airplane01Icon} size={15} strokeWidth={2.5} color="#10B981" />
                  Flights
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10B981] rounded-full" />
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-[30%] transition-colors relative text-gray-400 hover:text-gray-600 font-semibold">
                  <HugeiconsIcon icon={Calendar03Icon} size={15} strokeWidth={1.5} />
                  Events
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#F8FBFB] p-4">
            <p className="text-sm font-semibold text-[#173433]">Date picker reference</p>
            <p className="mt-1 text-sm text-[#6A8381]">
              Your Flights screen already has a custom sheet-based date picker. This inline calendar gives you a fixed visual ruler for spacing, typography, and selected-state color.
            </p>
            <div className="mt-4 rounded-[24px] bg-white p-3">
              <Calendar mode="single" selected={date} onSelect={setDate} className="mx-auto" />
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="cards"
        title="Cards, list rows, and app-specific surfaces"
        description="This section puts your reusable shells and your flight-specific surfaces in the same room, where inconsistencies can’t hide."
      >
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <PreviewDestinationCard />

            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewMultiDestCard />
              <div className="rounded-2xl overflow-hidden bg-[#F2F6F6] p-4">
                <PreviewFlightDestCard />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-[24px] border-[#E8EEEE] shadow-none">
                <CardHeader>
                  <CardTitle className="text-[#173433]">Standard content card</CardTitle>
                  <CardDescription>Good for dashboards, account surfaces, and grouped content.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#F7FAFA] px-4 py-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" />
                      <AvatarFallback>KR</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-[#173433]">Traveler profile</p>
                      <p className="text-xs text-[#7B9392]">Avatar, title, subtitle, and action alignment.</p>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-sm leading-6 text-[#5D7674]">
                    Use this shell when you need a dependable surface with a title, helper copy, content block, and footer action.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="rounded-2xl">Secondary action</Button>
                </CardFooter>
              </Card>

              <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
                <p className="text-sm font-semibold text-[#173433]">List row preview</p>
                <div className="mt-4 space-y-3">
                  {[
                    [Calendar03Icon, "Round trip search", "Wed Mar 4 · 2 travelers"],
                    [Location01Icon, "Chicago, IL", "ORD · 8 flights available"],
                    [UserGroupIcon, "Friends activity", "3 new items"],
                  ].map(([icon, title, copy]: any) => (
                    <button
                      key={title}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-[#EEF2F1] px-4 py-3 text-left transition-colors hover:bg-[#F7FAFA]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
                        <HugeiconsIcon icon={icon} size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#173433]">{title}</p>
                        <p className="truncate text-xs text-[#7B9392]">{copy}</p>
                      </div>
                      <HugeiconsIcon icon={ArrowRight04Icon} size={18} className="text-[#9CB0AE]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#F8FBFB] p-4">
            <p className="text-sm font-semibold text-[#173433]">Consistency checklist</p>
            <div className="mt-4">
              <Accordion type="single" collapsible className="w-full rounded-[22px] bg-white px-4">
                <AccordionItem value="spacing">
                  <AccordionTrigger>Spacing</AccordionTrigger>
                  <AccordionContent>
                    Compare outer card padding, inner section gaps, chip spacing, and footer button margins across every card family.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="hierarchy">
                  <AccordionTrigger>Information hierarchy</AccordionTrigger>
                  <AccordionContent>
                    Keep the location or airport code dominant, then stack supporting metrics like price, duration, and availability below it.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="states">
                  <AccordionTrigger>States</AccordionTrigger>
                  <AccordionContent>
                    Hover, active, selected, disabled, loading, and error should all speak the same visual dialect.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="chips"
        title="Chips & Badges"
        description="Small visual indicators used for categories, status, and filtering."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-6 shadow-sm">
            <h3 className="text-[#173433] font-bold mb-4 text-sm">Action Filters</h3>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">Nonstop</span>
              <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">GoWild</span>
              <span className="text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-1 rounded-full">Filter Active</span>
            </div>
            
            <h3 className="text-[#173433] font-bold mt-6 mb-4 text-sm">Status & Pricing</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1 bg-[#10B981] rounded-full px-2.5 py-1">
                <HugeiconsIcon icon={TicketStarIcon} size={11} color="white" strokeWidth={2} />
                <span className="text-[10px] font-bold text-white leading-none">GO WILD</span>
              </div>
              <Badge className="rounded-full bg-[#0F766E] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0F766E]">
                8 flights
              </Badge>
              <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-[#F0F4F4] text-[#2E4A4A]">
                $212
              </span>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="feedback"
        title="Loading states and feedback patterns"
        description="Tiny support components quietly decide whether the app feels polished or patchwork."
      >
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
              <p className="text-sm font-semibold text-[#173433] mb-4">Production Split-flap Effect</p>
              <SplitFlapHeader word="SEARCHING" />
              <div className="mt-4">
                <SplitFlapHeader word="UPDATING" variant="gray" />
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      <div className="rounded-[24px] border border-dashed border-[#CFE0DE] bg-[#F9FCFC] px-5 py-4 text-sm text-[#617A78]">
        The goal here is not to freeze creativity. It is to give creativity a runway so every new screen feels like it belongs to the same aircraft.
      </div>
    </div>
  );
}
