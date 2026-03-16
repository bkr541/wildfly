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
  UserGroupIcon,
  UserAdd01Icon,
  InformationCircleIcon,
  TicketStarIcon,
  DollarCircleIcon
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
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["tabs", "Tabs"],
  ["cards", "Cards"],
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

function TokenSwatch({
  name,
  varName,
  swatchClass,
}: {
  name: string;
  varName: string;
  swatchClass: string;
}) {
  return (
    <div className="rounded-3xl border border-[#E7ECEC] bg-[#F8FBFB] p-3">
      <div className={cn("h-20 rounded-2xl border border-black/5", swatchClass)} />
      <div className="mt-3">
        <p className="text-sm font-semibold text-[#173433]">{name}</p>
        <p className="text-xs tracking-[0.12em] text-[#7B9392] uppercase">{varName}</p>
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
          </div>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {colorTokens.map((token) => (
              <TokenSwatch key={token.varName} {...token} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
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
        title="Buttons, chips, and action hierarchy"
        description="Line up your action styles so the eye knows what matters in one heartbeat."
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[24px] border-[#E8EEEE] shadow-none">
              <CardHeader>
                <CardTitle className="text-[#173433]">Button variants</CardTitle>
                <CardDescription>Primary, secondary, outline, ghost, and link all in one pen.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>Primary action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Text action</Button>
                <Button size="icon" aria-label="Search">
                  <HugeiconsIcon icon={Search01Icon} size={18} />
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-[#E8EEEE] shadow-none">
              <CardHeader>
                <CardTitle className="text-[#173433]">Badge and chip language</CardTitle>
                <CardDescription>Use this to standardize pill height, casing, and semantic color mapping.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge className="rounded-full bg-[#10B981] px-3 py-1 text-white hover:bg-[#10B981]">Go Wild</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">Featured</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">4h 52m</Badge>
                <Badge variant="destructive" className="rounded-full px-3 py-1">Alert</Badge>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EDF7F5] px-3 py-2 text-sm font-semibold text-[#25635C]">
                  <HugeiconsIcon icon={Calendar03Icon} size={16} />
                  Wed Mar 4, 2026
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-sm text-[#6A8381]">
                  Pick one chip radius and one internal padding scale, then apply it everywhere: cards, tabs, headers, and search pills.
                </p>
              </CardFooter>
            </Card>

            <Card className="rounded-[24px] border-[#E8EEEE] shadow-none lg:col-span-2">
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
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="forms"
        title="Forms, input patterns, and selection controls"
        description="This is the highest-payoff section for consistency because forms are where users notice tiny misalignments."
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <AppInput
                label="Departure airport"
                icon={Airplane01Icon}
                value={airport}
                clearable
                onClear={() => setAirport("")}
                onChange={(event) => setAirport(event.target.value)}
                placeholder="ATL | Atlanta"
              />

              <AppInput
                label="Search friends"
                icon={Search01Icon}
                value="Kody"
                clearable
                placeholder="Search by username"
                onClear={() => undefined}
                readOnly
              />

              <Input defaultValue="Secondary input" className="h-12 rounded-2xl border-[#DCE7E6]" />

              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[112px] rounded-2xl border-[#DCE7E6]"
              />
            </div>

            <div className="grid gap-4 rounded-[24px] bg-[#F8FBFB] p-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#173433]">Select / dropdown</p>
                <Select defaultValue="atl">
                  <SelectTrigger className="h-12 rounded-2xl border-[#DCE7E6] bg-white">
                    <SelectValue placeholder="Choose airport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atl">ATL | Atlanta</SelectItem>
                    <SelectItem value="ord">ORD | Chicago</SelectItem>
                    <SelectItem value="den">DEN | Denver</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#173433]">Trip type radio group</p>
                <RadioGroup value={searchMode} onValueChange={setSearchMode} className="grid grid-cols-2 gap-3">
                  {[
                    ["one-way", "One Way"],
                    ["round-trip", "Round Trip"],
                    ["day-trip", "Day Trip"],
                    ["multi-day", "Multi Day"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                        searchMode === value
                          ? "border-[#10B981] bg-[#ECFDF5] text-[#065F46]"
                          : "border-[#DCE7E6] bg-white text-[#2E4A4A]",
                      )}
                    >
                      <RadioGroupItem value={value} id={value} />
                      <span className="text-sm font-semibold">{label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] bg-[#F8FBFB] p-4">
              <p className="text-sm font-semibold text-[#173433]">Boolean controls</p>
              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <span>
                    <p className="text-sm font-semibold text-[#173433]">Remember me</p>
                    <p className="text-xs text-[#7B9392]">Use the same copy pattern everywhere.</p>
                  </span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </label>

                <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <span>
                    <p className="text-sm font-semibold text-[#173433]">Include nearby airports</p>
                    <p className="text-xs text-[#7B9392]">Checkboxes and switches should feel related, not distant cousins.</p>
                  </span>
                  <Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} />
                </label>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#F8FBFB] p-4">
              <p className="text-sm font-semibold text-[#173433]">Density / spacing control</p>
              <div className="mt-5 rounded-2xl bg-white px-4 py-5">
                <Slider value={density} min={8} max={24} step={1} onValueChange={setDensity} />
                <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[#809795]">
                  <span>Compact</span>
                  <span>{density[0]}px</span>
                  <span>Relaxed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="tabs"
        title="Tabs, date selection, and grouped navigation"
        description="Great for comparing active states, border treatments, and section padding without opening three different screens."
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-[22px] bg-[#F2F6F5] p-1.5">
                <TabsTrigger value="search" className="rounded-[18px] py-3 text-sm font-semibold">
                  Search
                </TabsTrigger>
                <TabsTrigger value="results" className="rounded-[18px] py-3 text-sm font-semibold">
                  Results
                </TabsTrigger>
                <TabsTrigger value="saved" className="rounded-[18px] py-3 text-sm font-semibold">
                  Saved
                </TabsTrigger>
              </TabsList>

              <div className="mt-6 rounded-[24px] bg-[#F8FBFB] p-4">
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

              <TabsContent value="search" className="mt-4 rounded-[24px] bg-[#F8FBFB] p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <HugeiconsIcon icon={Airplane01Icon} size={20} className="text-[#059669]" />
                    <p className="mt-3 text-sm font-semibold text-[#173433]">Origin</p>
                    <p className="text-xs text-[#7C9492]">ATL | Atlanta</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <HugeiconsIcon icon={ArrowRight04Icon} size={20} className="text-[#059669]" />
                    <p className="mt-3 text-sm font-semibold text-[#173433]">Trip direction</p>
                    <p className="text-xs text-[#7C9492]">One way</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <HugeiconsIcon icon={Calendar03Icon} size={20} className="text-[#059669]" />
                    <p className="mt-3 text-sm font-semibold text-[#173433]">Travel date</p>
                    <p className="text-xs text-[#7C9492]">{date ? format(date, "EEE, MMM d") : "Choose a day"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="results" className="mt-4 rounded-[24px] bg-[#F8FBFB] p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[#173433]">Fastest option</span>
                    <Badge variant="outline" className="rounded-full">2h 14m</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[#173433]">Cheapest option</span>
                    <Badge variant="outline" className="rounded-full">$212</Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="saved" className="mt-4 rounded-[24px] bg-[#F8FBFB] p-4">
                <p className="text-sm text-[#5F7876]">Perfect place to standardize empty states, metadata tone, and row spacing.</p>
              </TabsContent>
            </Tabs>
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
        id="feedback"
        title="Tables, loading states, and feedback patterns"
        description="Tiny support components quietly decide whether the app feels polished or patchwork."
      >
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#173433]">Audit matrix</p>
                  <p className="text-sm text-[#6A8381]">Use this as a living checklist as you standardize the app.</p>
                </div>
                <Badge variant="outline" className="rounded-full">6 targets</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#EEF2F1]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Element</TableHead>
                      <TableHead>Standardize</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.map((row) => (
                      <TableRow key={row.element}>
                        <TableCell className="font-semibold text-[#173433]">{row.element}</TableCell>
                        <TableCell>{row.standard}</TableCell>
                        <TableCell>{row.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#173433]">Progress and status</p>
                    <p className="text-sm text-[#6A8381]">Useful for onboarding, uploads, and async search states.</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setProgress((value) => (value >= 92 ? 24 : value + 8))}>
                    Advance
                  </Button>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#2E4A4A]">
                      <span>Design system rollout</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-full bg-[#ECFDF5] px-3 py-1 text-[#047857] hover:bg-[#ECFDF5]">Healthy</Badge>
                    <Badge className="rounded-full bg-[#FFF7ED] px-3 py-1 text-[#C2410C] hover:bg-[#FFF7ED]">Needs review</Badge>
                    <Badge className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[#4338CA] hover:bg-[#EEF2FF]">In progress</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
                <p className="text-sm font-semibold text-[#173433]">Skeleton / loading reference</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#EEF2F1] p-3">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#EEF2F1] p-3">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#E8EEEE] bg-white p-4">
                <p className="text-sm font-semibold text-[#173433] mb-4">Production Split-flap Effect</p>
                <SplitFlapHeader word="SEARCHING" />
                <div className="mt-4">
                  <SplitFlapHeader word="UPDATING" variant="gray" />
                </div>
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
