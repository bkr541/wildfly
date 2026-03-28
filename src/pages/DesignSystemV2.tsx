/**
 * DesignSystemV2.tsx
 *
 * THE MASTER GUIDE — every component, token, and pattern in this file
 * is the canonical version the rest of the app should conform to.
 *
 * Status badges:
 *   ✓ Complete  — locked, canonical, use this everywhere
 *   Draft       — documented but not yet fully reconciled across the app
 */

import React, { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon, Airplane01Icon, AirplaneTakeOff01Icon, AirplaneTakeOff02Icon,
  AirplaneLanding01Icon, AirportIcon, Location01Icon, Location04Icon,
  MapsLocation02Icon, MapPinpoint01Icon, Calendar03Icon, CalendarCheckOut02Icon,
  CalendarCheckIn02Icon, Clock01Icon, Timer02Icon, SunriseIcon, SunCloud01Icon,
  UserGroupIcon, UserAdd01Icon, LoginSquare01Icon, Logout01Icon, Search01Icon,
  GlobalSearchIcon, Call02Icon, ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon,
  ArrowRight04Icon, ArrowUp01Icon, CircleArrowReload01Icon, CircleArrowRight02Icon,
  TicketStarIcon, DollarCircleIcon, CreditCardIcon, Coins01Icon, FilterIcon,
  SortByDown02Icon, Cancel01Icon, AddCircleIcon, Delete01Icon, FavouriteIcon,
  HeartAddIcon, BookmarkAdd01Icon, Mail01Icon, PencilEdit01Icon, SecurityIcon,
  RepeatIcon, FlashIcon, ViewIcon, ViewOffSlashIcon, CheckmarkCircle01Icon,
  Alert01Icon, AlertCircleIcon, Loading03Icon, InputTextIcon, AspectRatioIcon,
  UserIcon, CheckmarkBadge01Icon, Navigation01Icon, Cursor01Icon, Cards01Icon,
  ArrowLeftRightIcon, BarChartIcon, CheckmarkSquare01Icon, MenuCollapseIcon,
  CommandIcon, MouseRightClick01Icon, MessagePreview01Icon, SidebarLeft01Icon,
  ListViewIcon, FileEditIcon, MouseLeftClick01Icon, LockPasswordIcon, LabelIcon,
  Menu02Icon, Files01Icon, Message01Icon, Progress01Icon, RadioButtonIcon,
  Resize01Icon, ScrollVerticalIcon, Select01Icon, DivideSignIcon, SidebarRightIcon,
  SidebarLeftIcon, Loading01Icon, SlidersHorizontalIcon, Notification03Icon,
  ToggleOnIcon, Table01Icon, LayoutTopIcon, NoteEditIcon, Notification01Icon,
  Notification02Icon, ToggleOffIcon, HelpCircleIcon, InformationCircleIcon,
  ColorsIcon, TextFontIcon, Grid02Icon, Tag01Icon, CheckListIcon, Rocket01Icon,
  UnavailableIcon, TrafficLightIcon, RouteIcon, CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AppInput } from "@/components/ui/app-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Shell ───────────────────────────────────────────────────────────────────

const surfaceCard =
  "rounded-[28px] border border-[#E7ECEC] bg-white shadow-[0_18px_40px_rgba(21,41,40,0.08)]";

// ─── Status badges ────────────────────────────────────────────────────────────

function StatusComplete() {
  return (
    <span className="inline-flex align-middle items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-xs font-bold text-[#065F46]">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} color="#065F46" strokeWidth={2.5} />
      Complete
    </span>
  );
}

function StatusDraft() {
  return (
    <span className="inline-flex align-middle items-center gap-1 rounded-full bg-[#F2F3F3] px-2 py-0.5 text-xs font-bold text-[#6B7B7B]">
      <HugeiconsIcon icon={PencilEdit01Icon} size={10} color="currentColor" strokeWidth={2.5} />
      Draft
    </span>
  );
}

// ─── Demo scaffolding ─────────────────────────────────────────────────────────

function DemoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F8FBFB] border border-[#EEF2F1] p-4 space-y-4 text-[#2E4A4A]">
      {children}
    </div>
  );
}

function StateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function OverlayNote({ text }: { text: string }) {
  return (
    <DemoBox>
      <p className="text-xs text-[#8C9F9E]">{text}</p>
    </DemoBox>
  );
}

// ─── Color tokens ─────────────────────────────────────────────────────────────

/**
 * CANONICAL COLOR TOKENS
 * These are the only colors that should appear in the app.
 * All hardcoded hex values in screens should be replaced with the
 * corresponding --wf-* CSS variable or Tailwind token.
 */
const colorTokens = [
  // Brand
  {
    group: "Brand",
    tokens: [
      { name: "Brand",          variable: "--wf-brand",           hex: "#10B981", tailwind: "bg-brand",       usage: "CTAs, active nav, focus rings, links" },
      { name: "Brand Mid",      variable: "--wf-brand-mid",       hex: "#059669", tailwind: "bg-brand-mid",   usage: "Hover states, secondary buttons, badges" },
    ],
  },
  // Surfaces
  {
    group: "Surfaces",
    tokens: [
      { name: "Surface",        variable: "--wf-surface",         hex: "#FFFFFF", tailwind: "bg-surface",        usage: "Cards, modals, sheets" },
      { name: "Surface Subtle", variable: "--wf-surface-subtle",  hex: "#F7F8F8", tailwind: "bg-surface-subtle", usage: "Nested card backgrounds, demo boxes" },
      { name: "Surface Muted",  variable: "--wf-surface-muted",   hex: "#F2F3F3", tailwind: "bg-surface-muted",  usage: "Input backgrounds, section fills" },
      { name: "Surface Hover",  variable: "--wf-surface-hover",   hex: "#E8F5F0", tailwind: "bg-surface-hover",  usage: "List row hover, active chip" },
      { name: "Surface Active", variable: "--wf-surface-active",  hex: "#D1FAE5", tailwind: "bg-surface-active", usage: "Success tint, GoWild highlight" },
      { name: "Page",           variable: "--wf-surface-page",    hex: "#F1F5F5", tailwind: "bg-surface-page",   usage: "App body background" },
    ],
  },
  // Text
  {
    group: "Text",
    tokens: [
      { name: "Text Primary",   variable: "--wf-text-primary",    hex: "#2E4A4A", tailwind: "text-brand-text",          usage: "Headings, strong body copy" },
      { name: "Text Secondary", variable: "--wf-text-secondary",  hex: "#6B7B7B", tailwind: "text-wf-text-secondary",   usage: "Labels, subtitles, captions" },
      { name: "Text Muted",     variable: "--wf-text-muted",      hex: "#9CA3AF", tailwind: "text-wf-text-muted",       usage: "Hints, placeholders" },
      { name: "Text Faint",     variable: "--wf-text-faint",      hex: "#9AADAD", tailwind: "text-wf-text-faint",       usage: "Disabled, very secondary info" },
    ],
  },
  // Borders
  {
    group: "Borders",
    tokens: [
      { name: "Border",         variable: "--wf-border",          hex: "#E3E6E6", tailwind: "border-wf-border",        usage: "Cards, inputs, dividers" },
      { name: "Border Subtle",  variable: "--wf-border-subtle",   hex: "#F0F1F1", tailwind: "border-wf-border-subtle", usage: "Hairline dividers within cards" },
      { name: "Border Strong",  variable: "--wf-border-strong",   hex: "#C8CDCD", tailwind: "border-wf-border-strong", usage: "Emphasis borders, timeline lines" },
    ],
  },
  // Accents
  {
    group: "Accents",
    tokens: [
      { name: "Coral",  variable: "--wf-accent-coral",  hex: "#F97055", tailwind: "bg-accent-coral",  usage: "Alerts, warm highlights, destination tags" },
      { name: "Amber",  variable: "--wf-accent-amber",  hex: "#F5A623", tailwind: "bg-accent-amber",  usage: "Badges, deal indicators, price highlights" },
      { name: "Sky",    variable: "--wf-accent-sky",    hex: "#38BDF8", tailwind: "bg-accent-sky",    usage: "Info states, flight route lines, maps" },
    ],
  },
  // Semantic
  {
    group: "Semantic",
    tokens: [
      { name: "Error",          variable: "--wf-error",           hex: "#f87171", tailwind: "text-wf-error",   usage: "Input errors, destructive actions" },
      { name: "Warning",        variable: "--wf-warning",         hex: "#FBBF24", tailwind: "text-wf-warning", usage: "Caution states" },
      { name: "Info",           variable: "--wf-info",            hex: "#60A5FA", tailwind: "text-wf-info",    usage: "Informational highlights" },
    ],
  },
];

function ColorGroupSection() {
  return (
    <div className="space-y-6 pt-1 pb-2">
      {colorTokens.map((group) => (
        <div key={group.group}>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#9AADAD] mb-3 px-1">{group.group}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.tokens.map((t) => (
              <div
                key={t.variable}
                className="rounded-2xl border border-[#EEF2F1] bg-white p-3"
                style={{ boxShadow: "0 4px 20px rgba(53,92,90,0.06)" }}
              >
                <div
                  className="h-14 rounded-xl w-full mb-3"
                  style={{ background: t.hex, border: t.hex === "#FFFFFF" ? "1px solid #E3E6E6" : undefined }}
                />
                <p className="text-[13px] font-bold text-[#173433] leading-tight">{t.name}</p>
                <p className="text-[10px] font-mono tracking-wide text-[#8C9F9E] mt-0.5">{t.hex}</p>
                <p className="text-[10px] font-mono text-[#10B981] mt-0.5">{t.variable}</p>
                <p className="text-[10px] font-mono text-[#9AADAD] mt-0.5">{t.tailwind}</p>
                <p className="text-[10px] text-[#8C9F9E] mt-1.5 leading-tight">{t.usage}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-[#FEF9EC] border border-[#FDE68A] p-3 mt-2">
        <p className="text-[11px] font-bold text-[#92400E] mb-1">⚠ Deprecated greens — do not use</p>
        <p className="text-[11px] text-[#92400E] leading-relaxed">
          The following values are present in the codebase but should be replaced with <span className="font-mono font-bold">--wf-brand</span> or <span className="font-mono font-bold">--wf-brand-mid</span>:{" "}
          <span className="font-mono">#047857, #064E3B, #345C5A, #2D6A4F, #2E4A4A (as green), #1A2E2E (as green)</span>
        </p>
      </div>
    </div>
  );
}

// ─── Typography ───────────────────────────────────────────────────────────────

/**
 * CANONICAL TYPE SCALE
 * Use text-wf-* classes from tailwind.config.ts.
 * Do not use arbitrary px values like text-[22px], text-[13px], etc.
 */
function TypographySection() {
  const scale = [
    { name: "Hero",    class: "text-wf-hero",  px: "28px", weight: "font-black",     usage: "Airport codes, price display, hero numbers" },
    { name: "2XL",     class: "text-wf-2xl",   px: "22px", weight: "font-bold",      usage: "Header display text, greeting (Hello,)" },
    { name: "XL",      class: "text-wf-xl",    px: "20px", weight: "font-bold",      usage: "Screen titles, section headings" },
    { name: "LG",      class: "text-wf-lg",    px: "16px", weight: "font-semibold",  usage: "Card section headings" },
    { name: "MD",      class: "text-wf-md",    px: "15px", weight: "font-semibold",  usage: "Card titles, list labels, widget headers" },
    { name: "Base",    class: "text-wf-base",  px: "13px", weight: "font-medium",    usage: "Primary body copy, input values" },
    { name: "SM",      class: "text-wf-sm",    px: "12px", weight: "font-medium",    usage: "Secondary body, timestamps, metadata" },
    { name: "XS",      class: "text-wf-xs",    px: "11px", weight: "font-semibold",  usage: "Section headers (uppercase), badges" },
    { name: "2XS",     class: "text-wf-2xs",   px: "10px", weight: "font-semibold",  usage: "Captions, tiny labels, status pills" },
  ];

  return (
    <div className="rounded-[24px] bg-[#F8FBFB] p-4 mt-1 mb-2 space-y-1">
      {scale.map((s) => (
        <div key={s.name} className="flex items-baseline gap-3 py-2 border-b border-[#EEF2F1] last:border-0">
          <div className="w-12 shrink-0">
            <span className="text-[10px] font-mono text-[#9AADAD]">{s.px}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(s.class, s.weight, "text-[#173433] leading-tight truncate")}>
              {s.name} — The quick brown fox
            </p>
            <p className="text-[10px] text-[#9AADAD] mt-0.5 font-mono">{s.class} · {s.weight} · {s.usage}</p>
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-[#FEF9EC] border border-[#FDE68A] p-3 mt-2">
        <p className="text-[11px] font-bold text-[#92400E] mb-1">⚠ Deprecated sizes — do not use</p>
        <p className="text-[11px] text-[#92400E] leading-relaxed font-mono">
          text-[9px], text-[17px], text-[19px], text-[24px], text-[26px], text-[28px], text-[42px]
        </p>
        <p className="text-[11px] text-[#92400E] mt-1">Map these to the nearest <span className="font-mono">text-wf-*</span> step above.</p>
      </div>
    </div>
  );
}

// ─── Result Screen Header ─────────────────────────────────────────────────────

/**
 * CANONICAL RESULT SCREEN HEADER
 * Used by: FlightDestResults, FlightMultiDestResults, DayTripResults
 * Class: header-brand (defined in index.css)
 * Do NOT build a custom header in each results screen — use this pattern.
 */
function ResultHeaderSection() {
  return (
    <div className="space-y-4 pt-1 pb-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#9AADAD] px-1">
        Result screen header pattern
      </p>
      {/* Full bleed header demo */}
      <div className="rounded-2xl overflow-hidden border border-[#E3E6E6]">
        {/* The canonical header */}
        <div
          className="px-4 overflow-hidden"
          style={{ background: "linear-gradient(90deg, #10B981 0%, #059669 100%)" }}
        >
          <div className="flex items-center justify-between h-10 mt-1">
            <button className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity flex-shrink-0">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color="white" strokeWidth={2} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <span className="text-wf-md font-black text-white tracking-tight">DEN</span>
              <HugeiconsIcon icon={Airplane01Icon} size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
              <span className="text-wf-md font-black text-white tracking-tight truncate">All Destinations</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button className="h-8 w-8 flex items-center justify-center rounded-full border bg-white/10 border-white/30">
                <HugeiconsIcon icon={SortByDown02Icon} size={14} color="white" strokeWidth={2} />
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded-full border bg-white/10 border-white/30">
                <HugeiconsIcon icon={FilterIcon} size={14} color="white" strokeWidth={2} />
              </button>
            </div>
          </div>
          {/* Stats row */}
          <div className="flex items-center justify-center gap-4 mt-2 pb-2">
            {[["Destinations", "14"], ["Flights", "38"], ["From", "$49"]].map(([label, value]) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-wf-xs font-bold text-white/80">{label}</span>
                <span className="text-wf-sm font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Body placeholder */}
        <div className="bg-[#F1F5F5] px-4 py-3">
          <p className="text-wf-xs text-[#9AADAD] text-center">Flight result cards render here</p>
        </div>
      </div>

      {/* Usage guide */}
      <div className="rounded-xl bg-[#F8FBFB] border border-[#EEF2F1] p-3 space-y-2">
        <p className="text-[11px] font-bold text-[#2E4A4A]">Usage</p>
        <div className="space-y-1">
          {[
            ["CSS class", "header-brand (defined in index.css)"],
            ["Background", "linear-gradient(90deg, var(--wf-brand) 0%, var(--wf-brand-mid) 100%)"],
            ["Back button", "ArrowLeft01Icon, size 18, color white"],
            ["Title text", "text-wf-md font-black text-white"],
            ["Icon buttons", "h-8 w-8 rounded-full bg-white/10 border-white/30"],
            ["Stats row", "text-wf-xs text-white/80 label + text-wf-sm font-black text-white value"],
            ["Screens", "FlightDestResults · FlightMultiDestResults · DayTripResults"],
          ].map(([key, val]) => (
            <div key={key} className="flex gap-2 text-[11px]">
              <span className="font-semibold text-[#6B7B7B] shrink-0 w-24">{key}</span>
              <span className="text-[#9AADAD] font-mono leading-tight">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Icon chip ────────────────────────────────────────────────────────────────

function IconChip({ icon, label }: { icon: any; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#D5E6E2] bg-[#F6FBFA] px-3 py-2 text-wf-base font-semibold text-[#2E4A4A]">
      <HugeiconsIcon icon={icon} size={18} />
      <span>{label}</span>
    </div>
  );
}

// ─── Interactive demos ────────────────────────────────────────────────────────

function CheckboxDemo() {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(true);
  return (
    <DemoBox>
      <StateRow label="Unchecked"><Checkbox checked={c1} onCheckedChange={(v) => setC1(!!v)} /></StateRow>
      <StateRow label="Checked"><Checkbox checked={c2} onCheckedChange={(v) => setC2(!!v)} /></StateRow>
      <StateRow label="Disabled (unchecked)"><Checkbox disabled /></StateRow>
      <StateRow label="Disabled (checked)"><Checkbox checked disabled /></StateRow>
    </DemoBox>
  );
}

function ToggleGroupDemo() {
  const [val, setVal] = useState("left");
  return (
    <DemoBox>
      <StateRow label="Default variant — single select">
        <ToggleGroup type="single" value={val} onValueChange={(v) => v && setVal(v)}>
          <ToggleGroupItem value="left">Left</ToggleGroupItem>
          <ToggleGroupItem value="center">Center</ToggleGroupItem>
          <ToggleGroupItem value="right">Right</ToggleGroupItem>
        </ToggleGroup>
      </StateRow>
      <StateRow label="Outline variant">
        <ToggleGroup type="single" variant="outline" value={val} onValueChange={(v) => v && setVal(v)}>
          <ToggleGroupItem value="left">Left</ToggleGroupItem>
          <ToggleGroupItem value="center">Center</ToggleGroupItem>
          <ToggleGroupItem value="right">Right</ToggleGroupItem>
        </ToggleGroup>
      </StateRow>
    </DemoBox>
  );
}

type DestTab = "Info" | "Flights" | "Events";
const destTabOptions: { label: DestTab; icon: any }[] = [
  { label: "Info", icon: InformationCircleIcon },
  { label: "Flights", icon: AirplaneTakeOff01Icon },
  { label: "Events", icon: Calendar03Icon },
];

function TabsDemo() {
  const [activeTab, setActiveTab] = useState<DestTab>("Flights");
  return (
    <DemoBox>
      <StateRow label="Destination Tab Row (FlightDestResults)">
        <div className="relative z-10 flex items-center justify-around bg-white w-full border-b border-gray-200 rounded-lg overflow-hidden">
          {destTabOptions.map(({ label, icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveTab(label)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-3.5 w-[30%] transition-colors relative",
                "text-wf-md",
                label === activeTab ? "text-brand font-bold" : "text-[#9CA3AF] hover:text-[#6B7B7B] font-semibold",
              )}
            >
              <HugeiconsIcon
                icon={icon}
                size={15}
                strokeWidth={label === activeTab ? 2.5 : 1.5}
                color={label === activeTab ? "#10B981" : undefined}
              />
              {label}
              {label === activeTab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand rounded-full" />
              )}
            </button>
          ))}
        </div>
      </StateRow>
    </DemoBox>
  );
}

function AccordionDemo() {
  return (
    <DemoBox>
      <StateRow label="Single — one item expanded">
        <div className="w-full">
          <Accordion type="single" defaultValue="item-1" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger>Expanded item</AccordionTrigger>
              <AccordionContent>This panel is open by default.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Collapsed item</AccordionTrigger>
              <AccordionContent>This panel opens on click.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </StateRow>
    </DemoBox>
  );
}

function CollapsibleDemo() {
  const [open, setOpen] = useState(false);
  return (
    <DemoBox>
      <StateRow label={open ? "Expanded" : "Collapsed"}>
        <div className="w-full">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">{open ? "Hide" : "Show"} details</Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-wf-sm text-wf-text-secondary mt-2 px-1">Hidden content revealed when expanded.</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </StateRow>
    </DemoBox>
  );
}

function RadioGroupDemo() {
  const [val, setVal] = useState("option1");
  return (
    <DemoBox>
      <StateRow label="Default">
        <RadioGroup value={val} onValueChange={setVal} className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option1" id="r1" />
            <Label htmlFor="r1">Option 1 (selected)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option2" id="r2" />
            <Label htmlFor="r2">Option 2</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option3" id="r3" disabled />
            <Label htmlFor="r3" className="opacity-50">Option 3 (disabled)</Label>
          </div>
        </RadioGroup>
      </StateRow>
    </DemoBox>
  );
}

function AppInputDemo() {
  const [val, setVal] = useState("");
  const [phoneVal, setPhoneVal] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) formatted = `(${digits}`;
    setPhoneVal(formatted);
  };

  return (
    <DemoBox>
      <StateRow label="Default"><AppInput placeholder="Default input" value={val} onChange={(e) => setVal(e.target.value)} /></StateRow>
      <StateRow label="With Icon"><AppInput icon={Search01Icon} placeholder="Search flights" value={val} onChange={(e) => setVal(e.target.value)} /></StateRow>
      <StateRow label="With Label"><AppInput label="Origin" icon={Location01Icon} placeholder="e.g. New York" value={val} onChange={(e) => setVal(e.target.value)} /></StateRow>
      <StateRow label="Phone Number"><AppInput label="Phone Number" icon={Call02Icon} placeholder="(555) 000-0000" type="tel" inputMode="numeric" value={phoneVal} onChange={handlePhoneChange} /></StateRow>
      <StateRow label="Error"><AppInput placeholder="Enter email" error="Invalid email address" value={val} onChange={(e) => setVal(e.target.value)} /></StateRow>
      <StateRow label="Password"><AppInput isPassword placeholder="Enter password" value={val} onChange={(e) => setVal(e.target.value)} /></StateRow>
      <StateRow label="Clearable"><AppInput clearable placeholder="Clearable input" value={val} onChange={(e) => setVal(e.target.value)} onClear={() => setVal("")} /></StateRow>
      <StateRow label="Disabled"><AppInput placeholder="Disabled" disabled /></StateRow>
      <div className="rounded-xl bg-[#F0FFF8] border border-[#A7F3D0] p-3 mt-1">
        <p className="text-[11px] font-bold text-[#065F46] mb-1">✓ This is the canonical input component</p>
        <p className="text-[11px] text-[#065F46]">
          All text inputs in the app must use <span className="font-mono font-bold">&lt;AppInput&gt;</span> or the{" "}
          <span className="font-mono font-bold">app-input-container</span> CSS class.
          Do not use raw <span className="font-mono">&lt;input&gt;</span> or shadcn{" "}
          <span className="font-mono">&lt;Input&gt;</span> for user-facing form fields.
        </p>
      </div>
    </DemoBox>
  );
}

function DatePickerDemo() {
  return (
    <DemoBox>
      <StateRow label="Departure Date — Empty">
        <div className="w-full">
          <label className="text-wf-sm font-bold text-brand-mid ml-1 mb-0 block">Departure Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-wf-lg text-wf-text-muted">Select date</span>
          </button>
        </div>
      </StateRow>
      <StateRow label="Departure Date — Selected">
        <div className="w-full">
          <label className="text-wf-sm font-bold text-brand-mid ml-1 mb-0 block">Departure Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-wf-lg text-brand-text">Mar 20, 2026</span>
          </button>
        </div>
      </StateRow>
      <StateRow label="Return Date — Empty">
        <div className="w-full">
          <label className="text-wf-sm font-bold text-brand-mid ml-1 mb-0 block">Return Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-wf-lg text-wf-text-muted">Select date</span>
          </button>
        </div>
      </StateRow>
    </DemoBox>
  );
}

const DEMO_TRIP_FLEX = 1.7;
const demoTripOptions = [
  { value: "one-way",    label: "One Way",    icon: ArrowRight04Icon },
  { value: "round-trip", label: "Round Trip", icon: CircleArrowReload01Icon },
  { value: "day-trip",   label: "Day Trip",   icon: SunCloud01Icon },
  { value: "multi-day",  label: "Multi Day",  icon: MapPinpoint01Icon },
] as const;
type DemoTripType = typeof demoTripOptions[number]["value"];

function TripTypeSwitchDemo() {
  const [tripType, setTripType] = useState<DemoTripType>("one-way");
  return (
    <DemoBox>
      <StateRow label="Trip Type Switch (One Way / Round Trip / Day Trip / Multi Day)">
        <div
          className="rounded-full p-[2px] flex relative w-full"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13)",
          }}
        >
          <div
            className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out bg-brand"
            style={{
              width: `calc((100% - 4px) * ${DEMO_TRIP_FLEX} / ${demoTripOptions.length - 1 + DEMO_TRIP_FLEX})`,
              left: `calc(2px + (100% - 4px) * ${demoTripOptions.findIndex((o) => o.value === tripType)} / ${demoTripOptions.length - 1 + DEMO_TRIP_FLEX})`,
            }}
          />
          {demoTripOptions.map((opt) => {
            const isActive = tripType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTripType(opt.value)}
                style={{ flex: isActive ? DEMO_TRIP_FLEX : 1 }}
                className={cn(
                  "py-2.5 px-3 text-wf-base font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-wf-text-muted hover:text-wf-text-secondary",
                )}
              >
                <HugeiconsIcon icon={opt.icon} size={18} color="currentColor" strokeWidth={2} className="shrink-0" />
                {isActive && <span className="whitespace-nowrap">{opt.label}</span>}
              </button>
            );
          })}
        </div>
      </StateRow>
    </DemoBox>
  );
}

function AlertDialogDemo() {
  const [open, setOpen] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!confirmPw) { setConfirmError("Please confirm your password"); return; }
    setConfirmError(null);
    setOpen(false);
    setConfirmPw("");
  };

  return (
    <DemoBox>
      <StateRow label="Confirm Password dialog">
        <Button
          size="sm"
          className="bg-brand hover:bg-brand-mid text-white text-wf-xs"
          onClick={() => { setConfirmPw(""); setConfirmError(null); setOpen(true); }}
        >
          Open Dialog
        </Button>
      </StateRow>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-wf-xl font-bold text-brand-text">Confirm Password</AlertDialogTitle>
            <AlertDialogDescription className="text-wf-xs text-wf-text-secondary">Re-enter your password to finish.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2 text-wf-base border rounded bg-surface-subtle text-brand-text focus:outline-brand"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-wf-text-muted"
              >
                <HugeiconsIcon icon={showPw ? ViewOffSlashIcon : ViewIcon} size={14} color="currentColor" strokeWidth={1.5} />
              </button>
            </div>
            {confirmError && <p className="text-wf-error text-wf-2xs mt-1 font-bold">{confirmError}</p>}
          </div>
          <AlertDialogFooter className="flex-row gap-2 mt-2">
            <AlertDialogAction
              onClick={handleConfirm}
              className="w-full bg-brand hover:bg-brand-mid text-wf-xs py-1"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DemoBox>
  );
}

function FlightCardDemo() {
  const [expanded, setExpanded] = useState(false);
  return (
    <DemoBox>
      <StateRow label="Standard flight card">
        <div
          className={cn(
            "flex flex-col rounded-2xl bg-surface overflow-hidden transition-all duration-200 w-full",
            expanded ? "border border-brand-deeper/20" : "border border-wf-border",
          )}
          style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
        >
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-left w-full px-4 pt-3.5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-wf-base font-bold text-brand-text">Frontier Airlines</span>
              <span className="text-wf-base font-bold px-2.5 py-1 rounded-full bg-surface-muted text-brand-text">$49</span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-wf-2xl font-bold text-brand-text-deep leading-none tabular-nums">6:15 AM</span>
              <div className="flex-1 flex items-center gap-1 px-1">
                <div className="flex-1 h-px bg-wf-border-strong" />
                <HugeiconsIcon icon={Airplane01Icon} size={20} color="#2E4A4A" strokeWidth={2} />
                <div className="flex-1 h-px bg-wf-border-strong" />
              </div>
              <span className="text-wf-2xl font-bold text-brand-text-deep leading-none tabular-nums">9:45 AM</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-wf-base text-wf-text-secondary font-medium">Denver, CO</span>
              <span className="shrink-0 text-wf-xs font-semibold text-[#065F46] bg-surface-active px-2.5 py-0.5 rounded-full">3h 30m</span>
              <span className="text-wf-base text-wf-text-secondary font-medium text-right">Miami, FL</span>
            </div>
          </button>
          {expanded && (
            <div className="bg-surface px-2 py-3 border-t border-wf-border/50">
              <div className="flex items-center justify-end gap-2 px-3 pt-1 pb-1">
                <button className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-wf-xs font-semibold border bg-surface text-wf-text-secondary border-wf-border-strong">
                  Alert Me
                </button>
                <button className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-wf-xs font-semibold bg-brand-mid text-white border border-brand-mid">
                  $49 ›
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-wf-2xs text-wf-text-faint mt-1">Tap card to expand/collapse action row</p>
      </StateRow>

      <StateRow label="GoWild flight (green border + badge)">
        <div
          className="flex flex-col rounded-2xl bg-surface overflow-hidden w-full border border-brand"
          style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
        >
          <div className="text-left w-full px-4 pt-3.5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-wf-base font-bold text-brand-text">Frontier Airlines</span>
              <span className="text-wf-base font-bold px-2.5 py-1 rounded-full bg-surface-active text-[#065F46]">GO WILD</span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-wf-2xl font-bold text-brand-text-deep leading-none tabular-nums">7:00 AM</span>
              <div className="flex-1 flex items-center gap-1 px-1">
                <div className="flex-1 h-px bg-wf-border-strong" />
                <HugeiconsIcon icon={Airplane01Icon} size={20} color="#10B981" strokeWidth={2} />
                <div className="flex-1 h-px bg-wf-border-strong" />
              </div>
              <span className="text-wf-2xl font-bold text-brand-text-deep leading-none tabular-nums">10:15 AM</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-wf-base text-wf-text-secondary font-medium">Denver, CO</span>
              <span className="shrink-0 text-wf-xs font-semibold text-[#065F46] bg-surface-active px-2.5 py-0.5 rounded-full">3h 15m</span>
              <span className="text-wf-base text-wf-text-secondary font-medium text-right">Orlando, FL</span>
            </div>
          </div>
        </div>
      </StateRow>
    </DemoBox>
  );
}

function DestCardDemo() {
  return (
    <DemoBox>
      <StateRow label="Destination card (FlightMultiDestResults)">
        <div
          className="rounded-2xl overflow-hidden bg-surface border border-wf-border w-full"
          style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
        >
          <div
            className="relative h-[130px] overflow-hidden"
            style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)" }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)" }} />
            <div
              className="absolute top-3 right-3 flex-shrink-0 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(232,235,235,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
            >
              <span className="text-wf-md font-black leading-none text-brand-text-deep">$89</span>
            </div>
          </div>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-wf-xl font-black text-brand-text-deep leading-tight flex-1 mr-2">
                <span className="text-brand">MIA</span>
                <span className="text-wf-text-secondary font-normal text-wf-md"> | </span>
                Miami
                <span className="text-wf-text-secondary font-normal text-wf-lg">, FL</span>
              </h3>
              <span className="text-wf-sm text-wf-text-secondary font-medium flex-shrink-0">8 Flights</span>
            </div>
            <div className="border-t border-wf-border-subtle my-2.5" />
            <div className="flex items-center justify-end">
              <button className="px-4 py-1.5 rounded-full text-wf-sm font-semibold text-white bg-brand-gradient">
                View Flights
              </button>
            </div>
          </div>
        </div>
      </StateRow>
    </DemoBox>
  );
}

// ─── Canonical button demo ────────────────────────────────────────────────────

function ButtonDemo() {
  return (
    <DemoBox>
      <StateRow label="Primary CTA (use for: Log In, Search Flights, Save, Confirm)">
        <button className="w-full h-12 rounded-full btn-brand shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-6">
          <span className="tracking-[0.35em]">Search Flights</span>
          <HugeiconsIcon icon={Airplane01Icon} size={18} color="white" strokeWidth={2} />
        </button>
      </StateRow>
      <StateRow label="Primary CTA — Disabled">
        <button disabled className="w-full h-12 rounded-full btn-brand shadow-lg transition-all flex items-center justify-center gap-2 px-6 opacity-50 cursor-not-allowed">
          <span className="tracking-[0.35em]">Search Flights</span>
        </button>
      </StateRow>
      <StateRow label="shadcn variants (for utility actions only)">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </StateRow>
      <div className="rounded-xl bg-[#F0FFF8] border border-[#A7F3D0] p-3 mt-1">
        <p className="text-[11px] font-bold text-[#065F46] mb-1">✓ Canonical button rule</p>
        <p className="text-[11px] text-[#065F46]">
          Primary actions always use the <span className="font-mono font-bold">btn-brand</span> class (defined in index.css).
          Do not use <span className="font-mono">bg-gradient-to-r from-[#10B981] to-[#059669]</span> inline — use the class.
          shadcn variants are for secondary/utility actions only.
        </p>
      </div>
    </DemoBox>
  );
}

// ─── Canonical badge demo ─────────────────────────────────────────────────────

function BadgeDemo() {
  return (
    <DemoBox>
      <StateRow label="Trip Type badges">
        {[
          { label: "One Way",    icon: ArrowRight04Icon },
          { label: "Round Trip", icon: CircleArrowReload01Icon },
          { label: "Day Trip",   icon: SunCloud01Icon },
          { label: "Multi Day",  icon: MapPinpoint01Icon },
        ].map(({ label, icon }) => (
          <div
            key={label}
            className="inline-flex items-center gap-0.5 rounded-full text-wf-xs font-semibold"
            style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8", padding: "0.5px 6.5px" }}
          >
            <HugeiconsIcon icon={icon} size={10} color="#1D4ED8" strokeWidth={2} />
            {label}
          </div>
        ))}
      </StateRow>

      <StateRow label="Status badges">
        {[
          { label: "GoWild",           bg: "#4A7C59",  color: "#FFFFFF", icon: Rocket01Icon },
          { label: "Blackout",         bg: "#111827",  color: "#FFFFFF", icon: UnavailableIcon },
          { label: "Cheapest",         bg: "#1E3A5F",  color: "#FFFFFF", icon: DollarCircleIcon },
          { label: "Quickest",         bg: "#D4AF37",  color: "#1A1A1A", icon: TrafficLightIcon },
          { label: "+1 Day",           bg: "#E89830",  color: "#FFFFFF", icon: Clock01Icon },
          { label: "Red Eye",          bg: "#DC2626",  color: "#FFFFFF", icon: Alert01Icon },
          { label: "Best Balance",     bg: "#7C3AED",  color: "#FFFFFF", icon: ArrowDown01Icon },
          { label: "Longest Time",     bg: "#D97706",  color: "#FFFFFF", icon: MapPinpoint01Icon },
        ].map(({ label, bg, color, icon }) => (
          <div
            key={label}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-wf-xs font-semibold"
            style={{ background: bg, color }}
          >
            <HugeiconsIcon icon={icon} size={10} color={color} strokeWidth={2} />
            {label}
          </div>
        ))}
      </StateRow>

      <StateRow label="Price badge — Standard">
        <div
          className="inline-flex flex-col items-end rounded-full px-6 py-3"
          style={{ background: "#FFFFFF", border: "2px solid #1E2D5A", boxShadow: "0 2px 8px rgba(30,45,90,0.10)" }}
        >
          <span className="text-wf-xs font-semibold leading-none" style={{ color: "#1E2D5A" }}>From</span>
          <span className="text-wf-hero font-black leading-tight tracking-tight" style={{ color: "#1E2D5A" }}>$213</span>
        </div>
      </StateRow>

      <StateRow label="Price badge — GoWild">
        <div
          className="inline-flex flex-col items-end rounded-full px-6 py-3"
          style={{ background: "#4A7C59", border: "2px solid #FFFFFF", boxShadow: "0 2px 8px rgba(74,124,89,0.25)" }}
        >
          <span className="text-wf-xs font-semibold leading-none text-white/80">From</span>
          <span className="text-wf-hero font-black leading-tight tracking-tight text-white">GoWild</span>
        </div>
      </StateRow>

      <div className="rounded-xl bg-[#F0FFF8] border border-[#A7F3D0] p-3 mt-1">
        <p className="text-[11px] font-bold text-[#065F46] mb-1">✓ These are the canonical badge styles</p>
        <p className="text-[11px] text-[#065F46]">
          All result screens must use these exact badge definitions.
          Do not create ad-hoc badge styles in individual screen files.
        </p>
      </div>
    </DemoBox>
  );
}

// ─── Section data ─────────────────────────────────────────────────────────────

type SectionStatus = "complete" | "draft";

const tokenSections: { label: string; desc: string; icon: any; status: SectionStatus; content: ReactNode }[] = [
  {
    label: "Color Tokens",
    desc: "Brand, surface, text, and semantic color palette",
    icon: ColorsIcon,
    status: "draft",
    content: <ColorGroupSection />,
  },
  {
    label: "Typography Scale",
    desc: "Font sizes, weights, and line-height ramp",
    icon: TextFontIcon,
    status: "draft",
    content: <TypographySection />,
  },
  {
    label: "Result Screen Header",
    desc: "Canonical flight result card header layout",
    icon: Airplane01Icon,
    status: "draft",
    content: <ResultHeaderSection />,
  },
  {
    label: "Iconography",
    desc: "Approved Hugeicons grouped by category",
    icon: Grid02Icon,
    status: "draft",
    content: (
      <div className="rounded-[24px] bg-[#F8FBFB] p-4 mt-1 mb-2 space-y-5">
        {[
          { group: "Navigation", icons: [
            [Home01Icon, "Home"], [ArrowLeft01Icon, "Back"], [ArrowRight01Icon, "Forward"],
            [ArrowDown01Icon, "Expand"], [ArrowUp01Icon, "Collapse"], [Cancel01Icon, "Close"], [AddCircleIcon, "Add"],
          ]},
          { group: "Flights & Travel", icons: [
            [Airplane01Icon, "Flight"], [AirplaneTakeOff01Icon, "Takeoff"], [AirplaneLanding01Icon, "Landing"],
            [AirportIcon, "Airport"], [TicketStarIcon, "GoWild"], [CircleArrowReload01Icon, "Round Trip"],
            [CircleArrowRight02Icon, "Nonstop"], [ArrowRight04Icon, "One Way"],
          ]},
          { group: "Location", icons: [
            [Location01Icon, "Location"], [Location04Icon, "Location Alt"], [MapsLocation02Icon, "Maps"], [MapPinpoint01Icon, "Pin"],
          ]},
          { group: "Date & Time", icons: [
            [Calendar03Icon, "Calendar"], [CalendarCheckOut02Icon, "Departure"], [CalendarCheckIn02Icon, "Return"],
            [Clock01Icon, "Clock"], [Timer02Icon, "Timer"], [SunriseIcon, "Sunrise"], [SunCloud01Icon, "Day Trip"],
          ]},
          { group: "Search & Filters", icons: [
            [Search01Icon, "Search"], [GlobalSearchIcon, "Global"], [FilterIcon, "Filter"], [SortByDown02Icon, "Sort"],
          ]},
          { group: "Finance", icons: [
            [DollarCircleIcon, "Price"], [CreditCardIcon, "Card"], [Coins01Icon, "Coins"], [FlashIcon, "Deal"],
          ]},
          { group: "User & Account", icons: [
            [UserIcon, "User"], [UserGroupIcon, "Friends"], [UserAdd01Icon, "Add User"],
            [Mail01Icon, "Email"], [LockPasswordIcon, "Password"], [SecurityIcon, "Security"],
            [PencilEdit01Icon, "Edit"], [ViewIcon, "Show"], [ViewOffSlashIcon, "Hide"],
          ]},
          { group: "Saves & Alerts", icons: [
            [FavouriteIcon, "Favorite"], [HeartAddIcon, "Save"], [BookmarkAdd01Icon, "Bookmark"],
            [Notification01Icon, "Notification"], [CheckmarkCircle01Icon, "Success"], [Alert01Icon, "Alert"],
          ]},
        ].map(({ group, icons }) => (
          <div key={group}>
            <p className="text-wf-2xs uppercase tracking-[0.14em] font-semibold text-wf-text-faint mb-2">{group}</p>
            <div className="flex flex-wrap gap-2">
              {icons.map(([icon, label]) => <IconChip key={label as string} icon={icon} label={label as string} />)}
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const componentSections: { label: string; desc: string; icon: any; status: SectionStatus; content?: ReactNode }[] = [
  { label: "Accordion",       desc: "Expandable disclosure sections",                        icon: ArrowDown01Icon,       status: "draft", content: <AccordionDemo /> },
  { label: "Alert",           desc: "Inline contextual messages and warnings",               icon: Alert01Icon,            status: "draft", content: (
    <DemoBox>
      <StateRow label="Default">
        <div className="w-full"><Alert><HugeiconsIcon icon={InformationCircleIcon} size={16} /><AlertTitle>Heads up</AlertTitle><AlertDescription>You can add components to your app.</AlertDescription></Alert></div>
      </StateRow>
      <StateRow label="Destructive">
        <div className="w-full"><Alert variant="destructive"><HugeiconsIcon icon={Alert01Icon} size={16} /><AlertTitle>Error</AlertTitle><AlertDescription>Your session has expired.</AlertDescription></Alert></div>
      </StateRow>
    </DemoBox>
  )},
  { label: "Alert Dialog",    desc: "Modal confirmation dialog with actions",          icon: AlertCircleIcon,        status: "draft", content: <AlertDialogDemo /> },
  { label: "App Input",       desc: "Branded text field with left icon and label",    icon: InputTextIcon,          status: "draft", content: <AppInputDemo /> },
  { label: "Avatar",          desc: "User profile image with fallback initials",      icon: UserIcon,               status: "draft", content: (
    <DemoBox>
      <StateRow label="Fallback (no image)">
        <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>WF</AvatarFallback></Avatar>
      </StateRow>
      <StateRow label="Sizes">
        <Avatar className="h-6 w-6 text-xs"><AvatarFallback>S</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>M</AvatarFallback></Avatar>
        <Avatar className="h-14 w-14 text-lg"><AvatarFallback>L</AvatarFallback></Avatar>
      </StateRow>
    </DemoBox>
  )},
  { label: "Badge",           desc: "Small status labels and trip type chips",       icon: CheckmarkBadge01Icon,   status: "draft", content: <BadgeDemo /> },
  { label: "Button",          desc: "Primary CTA and utility action styles",          icon: Cursor01Icon,           status: "draft", content: <ButtonDemo /> },
  { label: "Card",            desc: "Flight and destination result cards",             icon: Cards01Icon,            status: "draft", content: (
    <div className="space-y-3">
      <FlightCardDemo />
      <DestCardDemo />
    </div>
  )},
  { label: "Checkbox",        desc: "Boolean toggle for form selections",            icon: CheckmarkSquare01Icon,  status: "draft", content: <CheckboxDemo /> },
  { label: "Chip",            desc: "Tappable airport filter pills",                  icon: Tag01Icon,              status: "draft", content: (
    <DemoBox>
      <StateRow label="Recent Airport chip">
        <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1">
          {[{ iata: "DEN", city: "Denver" }, { iata: "MIA", city: "Miami" }, { iata: "LAX", city: "Los Angeles" }].map((a) => (
            <button key={a.iata} type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-wf-base font-semibold shrink-0 whitespace-nowrap"
              style={{ background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)", color: "#065F46", border: "1px solid #6EE7B7" }}
            >
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={12} color="#059669" strokeWidth={2.5} />
              <span className="font-bold">{a.iata}</span>
              <span className="opacity-60 font-medium">{a.city}</span>
            </button>
          ))}
        </div>
      </StateRow>
    </DemoBox>
  )},
  { label: "Collapsible",     desc: "Animated expand/collapse container",            icon: MenuCollapseIcon,       status: "draft", content: <CollapsibleDemo /> },
  { label: "Date Picker",     desc: "Calendar-based date input",                     icon: Calendar03Icon,         status: "draft", content: <DatePickerDemo /> },
  { label: "Progress",        desc: "Linear completion indicator",                   icon: Progress01Icon,         status: "draft", content: (
    <DemoBox>
      <StateRow label="0%"><Progress value={0} className="w-full" /></StateRow>
      <StateRow label="50%"><Progress value={50} className="w-full" /></StateRow>
      <StateRow label="100%"><Progress value={100} className="w-full" /></StateRow>
    </DemoBox>
  )},
  { label: "Radio Group",     desc: "Single-select option list",                     icon: RadioButtonIcon,        status: "draft", content: <RadioGroupDemo /> },
  { label: "Scroll Area",     desc: "Custom scrollable container",                   icon: ScrollVerticalIcon,     status: "draft", content: (
    <DemoBox>
      <StateRow label="Vertical scroll">
        <ScrollArea className="h-32 w-full rounded-md border p-3">
          {Array.from({ length: 12 }, (_, i) => <p key={i} className="text-wf-xs text-wf-text-secondary py-0.5">Item {i + 1}</p>)}
        </ScrollArea>
      </StateRow>
    </DemoBox>
  )},
  { label: "Select",          desc: "Dropdown option picker",                        icon: Select01Icon,           status: "draft", content: (
    <DemoBox>
      <StateRow label="Default">
        <Select><SelectTrigger className="w-40"><SelectValue placeholder="Select option" /></SelectTrigger>
          <SelectContent><SelectItem value="a">Option A</SelectItem><SelectItem value="b">Option B</SelectItem></SelectContent>
        </Select>
      </StateRow>
      <StateRow label="Disabled">
        <Select disabled><SelectTrigger className="w-40"><SelectValue placeholder="Disabled" /></SelectTrigger>
          <SelectContent><SelectItem value="x">X</SelectItem></SelectContent>
        </Select>
      </StateRow>
    </DemoBox>
  )},
  { label: "Separator",       desc: "Visual divider between content sections",       icon: DivideSignIcon,         status: "draft", content: (
    <DemoBox>
      <StateRow label="Horizontal">
        <div className="w-full space-y-2">
          <p className="text-wf-xs text-wf-text-secondary">Above</p>
          <Separator orientation="horizontal" />
          <p className="text-wf-xs text-wf-text-secondary">Below</p>
        </div>
      </StateRow>
    </DemoBox>
  )},
  { label: "Skeleton",        desc: "Loading placeholder shimmer",                   icon: Loading01Icon,          status: "draft", content: (
    <DemoBox>
      <StateRow label="Text lines">
        <div className="w-full space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
      </StateRow>
      <StateRow label="Card placeholder">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
        </div>
      </StateRow>
    </DemoBox>
  )},
  { label: "Slider",          desc: "Range value input control",                     icon: SlidersHorizontalIcon,  status: "draft", content: (
    <DemoBox>
      <StateRow label="Default"><Slider defaultValue={[0]} max={100} step={1} className="w-full" /></StateRow>
      <StateRow label="Mid (50%)"><Slider defaultValue={[50]} max={100} step={1} className="w-full" /></StateRow>
      <StateRow label="Range"><Slider defaultValue={[20, 70]} max={100} step={1} className="w-full" /></StateRow>
      <StateRow label="Disabled"><Slider defaultValue={[40]} max={100} step={1} disabled className="w-full" /></StateRow>
    </DemoBox>
  )},
  { label: "Switch (Trip Type)", desc: "Segmented trip type selector",                icon: ToggleOnIcon,          status: "draft", content: <TripTypeSwitchDemo /> },
  { label: "Table",           desc: "Tabular data display",                          icon: Table01Icon,            status: "draft", content: (
    <DemoBox>
      <StateRow label="Default">
        <div className="w-full">
          <Table>
            <TableHeader><TableRow><TableHead>Route</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-medium">JFK → LAX</TableCell><TableCell>Mar 20</TableCell><TableCell><Badge variant="secondary">On time</Badge></TableCell></TableRow>
              <TableRow><TableCell className="font-medium">ORD → MIA</TableCell><TableCell>Mar 25</TableCell><TableCell><Badge>Confirmed</Badge></TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      </StateRow>
    </DemoBox>
  )},
  { label: "Tabs",            desc: "Horizontal tab navigation row",                 icon: LayoutTopIcon,          status: "draft", content: <TabsDemo /> },
  { label: "Textarea",        desc: "Multi-line text input field",                   icon: NoteEditIcon,           status: "draft", content: (
    <DemoBox>
      <StateRow label="Default"><Textarea placeholder="Type your message…" className="max-w-xs" /></StateRow>
      <StateRow label="Disabled"><Textarea placeholder="Disabled textarea" disabled className="max-w-xs" /></StateRow>
    </DemoBox>
  )},
  { label: "Toggle Group",    desc: "Multi-option toggle button group",              icon: ToggleOffIcon,          status: "draft", content: <ToggleGroupDemo /> },
  // Draft items
  { label: "Calendar",        desc: "Full month date picker (in progress)",          icon: Calendar03Icon,         status: "draft", content: <OverlayNote text="Full month picker — states: Default, Focused, Selected, Disabled, Range. To be built." /> },
  { label: "Carousel",        desc: "Horizontally scrollable card reel",             icon: ArrowLeftRightIcon,     status: "draft", content: <OverlayNote text="Wraps embla-carousel. States: Default, Next, Previous, Loop. To be documented." /> },
  { label: "Command",         desc: "Searchable command palette",                    icon: CommandIcon,            status: "draft", content: <OverlayNote text="Searchable list (cmdk). States: Empty, Typing, Item focused, No results. To be built." /> },
  { label: "Drawer / Sheet",  desc: "Bottom slide-up sheet overlay",                 icon: SidebarLeft01Icon,      status: "draft", content: <OverlayNote text="Slides up from bottom (vaul). States: Closed, Open, Dragging, Snapped. To be documented." /> },
  { label: "Toast / Sonner",  desc: "Ephemeral notification toasts",                 icon: Notification01Icon,     status: "draft", content: <OverlayNote text="Ephemeral notifications. Types: Default, Success, Error, Warning, Loading. To be built." /> },
  { label: "Tooltip",         desc: "Hover-triggered contextual label",              icon: HelpCircleIcon,         status: "draft", content: <OverlayNote text="Appears on hover/focus. Sides: top, bottom, left, right. To be documented." /> },
  { label: "Multi Select",    desc: "Tag-based multi-option input",                  icon: CheckListIcon,          status: "draft", content: <OverlayNote text="Not yet built. Needed for: passenger count, filter tags, airport multi-select." /> },
  { label: "Searchbox",       desc: "Global airport and destination search",         icon: Search01Icon,           status: "draft", content: <OverlayNote text="Global search pattern. To be extracted from Flights and standardized." /> },
];

// ─── Collapsible row ──────────────────────────────────────────────────────────

function CollapsibleRow({
  label, desc, icon, status, isOpen, onToggle, children,
}: {
  label: string; desc?: string; icon: any; status: SectionStatus;
  isOpen: boolean; onToggle: () => void; children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center w-full px-5 py-3.5 gap-3 hover:bg-surface-subtle transition-colors text-left"
      >
        <span className="h-8 w-8 rounded-full bg-brand flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={15} color="white" strokeWidth={1.5} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#2E4A4A]">{label}</p>
          {desc && <p className="text-xs text-[#6B7B7B] mt-0.5">{desc}</p>}
        </div>
        {status === "complete" ? <StatusComplete /> : <StatusDraft />}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          color="#C4CACA"
          strokeWidth={1.5}
          className={`transition-transform duration-200 ml-1 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-4 pt-1">
          {children ?? (
            <div className="rounded-xl bg-surface-subtle border border-wf-border-subtle px-4 py-3">
              <p className="text-wf-xs text-wf-text-faint">Documentation coming soon.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemV2Page() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const completedComponents = componentSections.filter((s) => s.status === "complete").length;
  const totalComponents = componentSections.length;
  const completedTokens = tokenSections.filter((s) => s.status === "complete").length;
  const totalTokens = tokenSections.length;

  return (
    <div className="space-y-5 px-4 pb-24 pt-3 sm:px-5">

      {/* Hero */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-surface-active px-3 py-1 text-[#047857] hover:bg-surface-active">Master design guide</Badge>
            <Badge variant="outline" className="rounded-full border-wf-border text-wf-text-secondary">shadcn + Tailwind + Hugeicons</Badge>
            <Badge variant="outline" className="rounded-full border-wf-border text-wf-text-secondary">wf-* token system</Badge>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#173433]">Wildfly Design System</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#6B7B7B]">
              Components marked <StatusComplete /> are canonical.
              All screens must conform to them. <StatusDraft /> items are documented but not yet reconciled across the app.
            </p>
          </div>

          {/* Progress summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#F2F3F3] border border-[#E3E6E6] p-3">
              <p className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider mb-1">Tokens & Patterns</p>
              <p className="text-2xl font-black text-[#2E4A4A] leading-none">{completedTokens}<span className="text-sm font-semibold">/{totalTokens}</span></p>
              <p className="text-[10px] text-[#6B7B7B] mt-0.5">complete</p>
            </div>
            <div className="rounded-2xl bg-[#F2F3F3] border border-[#E3E6E6] p-3">
              <p className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider mb-1">Components</p>
              <p className="text-2xl font-black text-[#2E4A4A] leading-none">{completedComponents}<span className="text-sm font-semibold">/{totalComponents}</span></p>
              <p className="text-[10px] text-[#6B7B7B] mt-0.5">complete</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-[#E3E6E6] bg-[#F2F3F3] p-4">
            <HugeiconsIcon icon={InformationCircleIcon} size={18} color="#345C5A" strokeWidth={1.5} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#2E4A4A] mb-1">How to use this guide</p>
              <p className="text-xs text-[#6B7B7B]">
                When building or updating a screen, open the relevant component here first.
                Copy the exact class names, token names, and structure shown. Do not deviate from Complete components without updating this file first.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tokens */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
        <div className="border-b border-[#F0F1F1] px-5 py-4 sm:px-6">
          <h2 className="text-xl font-bold tracking-tight text-[#173433]">Tokens, Typography & Patterns</h2>
          <p className="mt-1 text-xs text-[#6B7B7B]">The canonical color, type, and layout primitives for the entire app.</p>
        </div>
        <div className="divide-y divide-[#F0F1F1]">
          {tokenSections.map(({ label, desc, icon, status, content }) => (
            <CollapsibleRow
              key={`token-${label}`}
              label={label}
              desc={desc}
              icon={icon}
              status={status}
              isOpen={openSections.has(`token-${label}`)}
              onToggle={() => toggleSection(`token-${label}`)}
            >
              {content}
            </CollapsibleRow>
          ))}
        </div>
      </div>

      {/* Components */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
        <div className="border-b border-[#F0F1F1] px-5 py-4 sm:px-6">
          <h2 className="text-xl font-bold tracking-tight text-[#173433]">Components</h2>
          <p className="mt-1 text-xs text-[#6B7B7B]">
            Expand any component to see its canonical implementation.
          </p>
        </div>
        <div className="divide-y divide-[#F0F1F1]">
          {componentSections.map(({ label, desc, icon, status, content }) => (
            <CollapsibleRow
              key={`component-${label}`}
              label={label}
              desc={desc}
              icon={icon}
              status={status}
              isOpen={openSections.has(`component-${label}`)}
              onToggle={() => toggleSection(`component-${label}`)}
            >
              {content}
            </CollapsibleRow>
          ))}
        </div>
      </div>

    </div>
  );
}
