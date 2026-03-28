import React, { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  Airplane01Icon,
  AirplaneTakeOff01Icon,
  AirplaneTakeOff02Icon,
  AirplaneLanding01Icon,
  AirportIcon,
  Location01Icon,
  Location04Icon,
  MapsLocation02Icon,
  MapPinpoint01Icon,
  Calendar03Icon,
  CalendarCheckOut02Icon,
  CalendarCheckIn02Icon,
  Clock01Icon,
  Timer02Icon,
  SunriseIcon,
  SunCloud01Icon,
  UserGroupIcon,
  UserAdd01Icon,
  LoginSquare01Icon,
  Logout01Icon,
  Search01Icon,
  GlobalSearchIcon,
  Call02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowRight04Icon,
  ArrowUp01Icon,
  CircleArrowReload01Icon,
  CircleArrowRight02Icon,
  TicketStarIcon,
  DollarCircleIcon,
  CreditCardIcon,
  Coins01Icon,
  FilterIcon,
  SortByDown02Icon,
  Cancel01Icon,
  AddCircleIcon,
  Delete01Icon,
  FavouriteIcon,
  HeartAddIcon,
  BookmarkAdd01Icon,
  Mail01Icon,
  PencilEdit01Icon,
  SecurityIcon,
  RepeatIcon,
  FlashIcon,
  ViewIcon,
  ViewOffSlashIcon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  AlertCircleIcon,
  Loading03Icon,
  InputTextIcon,
  AspectRatioIcon,
  UserIcon,
  CheckmarkBadge01Icon,
  Navigation01Icon,
  Cursor01Icon,
  Cards01Icon,
  ArrowLeftRightIcon,
  BarChartIcon,
  CheckmarkSquare01Icon,
  MenuCollapseIcon,
  CommandIcon,
  MouseRightClick01Icon,
  MessagePreview01Icon,
  SidebarLeft01Icon,
  ListViewIcon,
  FileEditIcon,
  MouseLeftClick01Icon,
  LockPasswordIcon,
  LabelIcon,
  Menu02Icon,
  Files01Icon,
  Message01Icon,
  Progress01Icon,
  RadioButtonIcon,
  Resize01Icon,
  ScrollVerticalIcon,
  Select01Icon,
  DivideSignIcon,
  SidebarRightIcon,
  SidebarLeftIcon,
  Loading01Icon,
  SlidersHorizontalIcon,
  Notification03Icon,
  ToggleOnIcon,
  Table01Icon,
  LayoutTopIcon,
  NoteEditIcon,
  Notification01Icon,
  Notification02Icon,
  ToggleOffIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  ColorsIcon,
  TextFontIcon,
  Grid02Icon,
  Tag01Icon,
  CheckListIcon,
  Rocket01Icon,
  UnavailableIcon,
  TrafficLightIcon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AppInput } from "@/components/ui/app-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const surfaceClass =
  "rounded-[28px] border border-[#E7ECEC] bg-white shadow-[0_18px_40px_rgba(21,41,40,0.08)]";

const colorTokens = [
  { name: "App Background", varName: "#F1F5F5", swatchClass: "bg-[#F1F5F5] border border-[#E5E9E9]" },
  { name: "Card Surface", varName: "#FFFFFF", swatchClass: "bg-white border border-[#E8EBEB]" },
  { name: "Primary Green", varName: "#10B981", swatchClass: "bg-[#10B981]" },
  { name: "Primary Dark", varName: "#059669", swatchClass: "bg-[#059669]" },
  { name: "Text Primary", varName: "#1A2E2E", swatchClass: "bg-[#1A2E2E]" },
  { name: "Text Secondary", varName: "#6B7B7B", swatchClass: "bg-[#6B7B7B]" },
  { name: "Border Light", varName: "#E8EBEB", swatchClass: "bg-[#E8EBEB]" },
  { name: "Highlight Green", varName: "#D1FAE5", swatchClass: "bg-[#D1FAE5]" },
];

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

// ─── Design System demo helpers ─────────────────────────────────────────────

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

// ─── Alert Dialog Demo ───────────────────────────────────────────────────────
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
      <StateRow label="Confirm Password dialog (from AuthPage sign-up)">
        <Button
          size="sm"
          className="bg-[#10B981] hover:bg-[#059669] text-white text-xs"
          onClick={() => { setConfirmPw(""); setConfirmError(null); setOpen(true); }}
        >
          Open Dialog
        </Button>
      </StateRow>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-lg font-bold text-[#2E4A4A]">Confirm Password</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B]">Re-enter your password to finish.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2 text-sm border rounded bg-gray-50 text-[#2E4A4A] focus:outline-[#10B981]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <HugeiconsIcon icon={showPw ? ViewOffSlashIcon : ViewIcon} size={14} color="currentColor" strokeWidth={1.5} />
              </button>
            </div>
            {confirmError && <p className="text-red-500 text-[10px] mt-1 font-bold">{confirmError}</p>}
          </div>
          <AlertDialogFooter className="flex-row gap-2 mt-2">
            <AlertDialogAction
              onClick={handleConfirm}
              className="w-full bg-[#10B981] hover:bg-[#059669] text-xs py-1"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DemoBox>
  );
}

// Interactive demos (need own state)
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
                "flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-[30%] transition-colors relative",
                label === activeTab ? "text-[#10B981] font-bold" : "text-gray-400 hover:text-gray-600 font-semibold",
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
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10B981] rounded-full" />
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
      <StateRow label="Multiple — multiple open simultaneously">
        <div className="w-full">
          <Accordion type="multiple" defaultValue={["a", "b"]}>
            <AccordionItem value="a"><AccordionTrigger>Item A (open)</AccordionTrigger><AccordionContent>Open content A.</AccordionContent></AccordionItem>
            <AccordionItem value="b"><AccordionTrigger>Item B (open)</AccordionTrigger><AccordionContent>Open content B.</AccordionContent></AccordionItem>
            <AccordionItem value="c"><AccordionTrigger>Item C (closed)</AccordionTrigger><AccordionContent>Open content C.</AccordionContent></AccordionItem>
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
              <p className="text-xs text-[#6B7B7B] mt-2 px-1">Hidden content revealed when expanded.</p>
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
    </DemoBox>
  );
}

function DatePickerDemo() {
  return (
    <DemoBox>
      <StateRow label="Departure Date — Empty">
        <div className="w-full">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base" style={{ color: "#6B7280" }}>
              Select date
            </span>
          </button>
        </div>
      </StateRow>
      <StateRow label="Departure Date — Selected">
        <div className="w-full">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base" style={{ color: "#1F2937" }}>
              Mar 20, 2026
            </span>
          </button>
        </div>
      </StateRow>
      <StateRow label="Return Date — Empty">
        <div className="w-full">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Return Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base" style={{ color: "#6B7280" }}>
              Select date
            </span>
          </button>
        </div>
      </StateRow>
      <StateRow label="Return Date — Selected">
        <div className="w-full">
          <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Return Date</label>
          <button type="button" className="app-input-container w-full text-left outline-none" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn">
              <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate px-[0.8em] py-[0.7em] text-base" style={{ color: "#1F2937" }}>
              Mar 27, 2026
            </span>
          </button>
        </div>
      </StateRow>
    </DemoBox>
  );
}

// ────────────────────────────────────────────────────────────────────────────

const DEMO_TRIP_FLEX = 1.7;
const demoTripOptions = [
  { value: "one-way", label: "One Way", icon: ArrowRight04Icon },
  { value: "round-trip", label: "Round Trip", icon: CircleArrowReload01Icon },
  { value: "day-trip", label: "Day Trip", icon: SunCloud01Icon },
  { value: "multi-day", label: "Multi Day", icon: MapPinpoint01Icon },
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
            className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
            style={{
              background: "#10B981",
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
                  "py-2.5 px-3 text-sm font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
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

function AuthToggleDemo() {
  const [isSignUp, setIsSignUp] = useState(false);
  return (
    <DemoBox>
      <StateRow label={isSignUp ? "Sign Up mode" : "Sign In mode"}>
        <p className="text-sm text-[#6B7280]">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[#10B981] font-bold hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </StateRow>
    </DemoBox>
  );
}

function FlightCardDemo() {
  const [expanded, setExpanded] = useState(false);
  return (
    <DemoBox>
      <StateRow label="Flight Result Card (FlightDestResults)">
        <div
          className={cn(
            "flex flex-col rounded-2xl bg-white overflow-hidden transition-all duration-200 w-full",
            expanded ? "border border-[#345C5A]/20" : "border border-[#E8EBEB]",
          )}
          style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
        >
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-left w-full px-4 pt-3.5 pb-3"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-[#2E4A4A]">Frontier Airlines</span>
              <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-[#F0F4F4] text-[#2E4A4A]">$49</span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">6:15 AM</span>
              <div className="flex-1 flex items-center gap-1 px-1">
                <div className="flex-1 h-px bg-[#C8D5D5]" />
                <HugeiconsIcon icon={Airplane01Icon} size={20} color="#2E4A4A" strokeWidth={2} />
                <div className="flex-1 h-px bg-[#C8D5D5]" />
              </div>
              <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">9:45 AM</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[#6B7B7B] font-medium">Denver, CO</span>
              <span className="shrink-0 text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-0.5 rounded-full">3h 30m</span>
              <span className="text-[13px] text-[#6B7B7B] font-medium text-right">Miami, FL</span>
            </div>
          </button>
          {expanded && (
            <div className="bg-white px-2 py-3 border-t border-[#E8EBEB]/50">
              <div className="flex items-center justify-end gap-2 px-3 pt-1 pb-1">
                <button className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold border bg-white text-[#4B5563] border-[#D1D5DB]">
                  Alert Me
                </button>
                <button className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold bg-[#059669] text-white border border-[#059669]">
                  $49 ›
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] text-[#93A8A7] mt-1">Tap card to expand/collapse action row</p>
      </StateRow>
      <StateRow label="GoWild Flight (green border + badge)">
        <div
          className="flex flex-col rounded-2xl bg-white overflow-hidden w-full border border-[#10B981]"
          style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
        >
          <div className="text-left w-full px-4 pt-3.5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-[#2E4A4A]">Frontier Airlines</span>
              <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-[#D1FAE5] text-[#065F46]">GO WILD</span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">7:00 AM</span>
              <div className="flex-1 flex items-center gap-1 px-1">
                <div className="flex-1 h-px bg-[#C8D5D5]" />
                <HugeiconsIcon icon={Airplane01Icon} size={20} color="#10B981" strokeWidth={2} />
                <div className="flex-1 h-px bg-[#C8D5D5]" />
              </div>
              <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">10:15 AM</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[#6B7B7B] font-medium">Denver, CO</span>
              <span className="shrink-0 text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-0.5 rounded-full">3h 15m</span>
              <span className="text-[13px] text-[#6B7B7B] font-medium text-right">Orlando, FL</span>
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
      <StateRow label="Destination Card (FlightMultiDestResults)">
        <div
          className="rounded-2xl overflow-hidden bg-white border border-[#E8EBEB] w-full"
          style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
        >
          <div className="relative h-[130px] overflow-hidden" style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)" }} />
            <div
              className="absolute top-3 right-3 flex-shrink-0 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(232,235,235,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
            >
              <span className="text-[14px] font-black leading-none text-[#1A2E2E]">$89</span>
            </div>
          </div>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[18px] font-black text-[#1A2E2E] leading-tight flex-1 mr-2">
                <span className="text-[#10B981]">MIA</span>
                <span className="text-[#6B7B7B] font-normal text-[15px]"> | </span>
                Miami
                <span className="text-[#6B7B7B] font-normal text-[16px]">, FL</span>
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
                  <span className="text-[12px] text-[#2E4A4A] truncate">Range: <span className="font-semibold">$49 – $129</span></span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                    <HugeiconsIcon icon={SunriseIcon} size={13} color="#6B7B7B" strokeWidth={2} />
                  </div>
                  <span className="text-[12px] text-[#2E4A4A] truncate">Earliest: <span className="font-semibold">Mar 20</span></span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                    <HugeiconsIcon icon={Clock01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                  </div>
                  <span className="text-[12px] text-[#2E4A4A] truncate">Quickest: <span className="font-semibold">3h 10m</span></span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,123,123,0.10)" }}>
                    <HugeiconsIcon icon={CircleArrowRight02Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                  </div>
                  <span className="text-[12px] text-[#2E4A4A] truncate">Nonstop: <span className="font-semibold">5</span></span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                View Flights
              </button>
            </div>
          </div>
        </div>
      </StateRow>
    </DemoBox>
  );
}

// ────────────────────────────────────────────────────────────────────────────

const tokenSections: { label: string; icon: any; content: ReactNode }[] = [
  {
    label: "Color",
    icon: ColorsIcon,
    content: (
      <div className="space-y-4 pt-1 pb-2">
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
      </div>
    ),
  },
  {
    label: "Typography",
    icon: TextFontIcon,
    content: (
      <div className="rounded-[24px] bg-[#F8FBFB] p-4 mt-1 mb-2">
        <div className="space-y-3 text-[#173433]">
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
    ),
  },
  {
    label: "Iconography",
    icon: Grid02Icon,
    content: (
      <div className="rounded-[24px] bg-[#F8FBFB] p-4 mt-1 mb-2 space-y-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#7E9694]">Icons in the current app voice</p>

        {/* Navigation */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Navigation</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={Home01Icon} label="Home" />
            <IconChip icon={ArrowLeft01Icon} label="Back" />
            <IconChip icon={ArrowRight01Icon} label="Forward" />
            <IconChip icon={ArrowDown01Icon} label="Expand" />
            <IconChip icon={ArrowUp01Icon} label="Collapse" />
            <IconChip icon={Cancel01Icon} label="Close" />
            <IconChip icon={AddCircleIcon} label="Add" />
          </div>
        </div>

        {/* Flights & Travel */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Flights & Travel</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={Airplane01Icon} label="Flight" />
            <IconChip icon={AirplaneTakeOff01Icon} label="Takeoff" />
            <IconChip icon={AirplaneTakeOff02Icon} label="Takeoff Alt" />
            <IconChip icon={AirplaneLanding01Icon} label="Landing" />
            <IconChip icon={AirportIcon} label="Airport" />
            <IconChip icon={TicketStarIcon} label="GoWild" />
            <IconChip icon={CircleArrowReload01Icon} label="Round Trip" />
            <IconChip icon={CircleArrowRight02Icon} label="Nonstop" />
            <IconChip icon={ArrowRight04Icon} label="One Way" />
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Location</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={Location01Icon} label="Location" />
            <IconChip icon={Location04Icon} label="Location Alt" />
            <IconChip icon={MapsLocation02Icon} label="Maps" />
            <IconChip icon={MapPinpoint01Icon} label="Pin" />
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Date & Time</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={Calendar03Icon} label="Calendar" />
            <IconChip icon={CalendarCheckOut02Icon} label="Departure" />
            <IconChip icon={CalendarCheckIn02Icon} label="Return" />
            <IconChip icon={Clock01Icon} label="Clock" />
            <IconChip icon={Timer02Icon} label="Timer" />
            <IconChip icon={SunriseIcon} label="Sunrise" />
            <IconChip icon={SunCloud01Icon} label="Day Trip" />
          </div>
        </div>

        {/* Search & Filters */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Search & Filters</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={Search01Icon} label="Search" />
            <IconChip icon={GlobalSearchIcon} label="Global Search" />
            <IconChip icon={FilterIcon} label="Filter" />
            <IconChip icon={SortByDown02Icon} label="Sort" />
          </div>
        </div>

        {/* Finance */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Finance</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={DollarCircleIcon} label="Price" />
            <IconChip icon={CreditCardIcon} label="Card" />
            <IconChip icon={Coins01Icon} label="Coins" />
            <IconChip icon={FlashIcon} label="Deal" />
          </div>
        </div>

        {/* User & Account */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">User & Account</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={UserIcon} label="User" />
            <IconChip icon={UserGroupIcon} label="Friends" />
            <IconChip icon={UserAdd01Icon} label="Add User" />
            <IconChip icon={LoginSquare01Icon} label="Sign In" />
            <IconChip icon={Logout01Icon} label="Sign Out" />
            <IconChip icon={Mail01Icon} label="Email" />
            <IconChip icon={LockPasswordIcon} label="Password" />
            <IconChip icon={SecurityIcon} label="Security" />
            <IconChip icon={PencilEdit01Icon} label="Edit" />
            <IconChip icon={ViewIcon} label="Show" />
            <IconChip icon={ViewOffSlashIcon} label="Hide" />
            <IconChip icon={Call02Icon} label="Phone" />
          </div>
        </div>

        {/* Saves & Alerts */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-2">Saves & Alerts</p>
          <div className="flex flex-wrap gap-2">
            <IconChip icon={FavouriteIcon} label="Favourite" />
            <IconChip icon={HeartAddIcon} label="Save" />
            <IconChip icon={BookmarkAdd01Icon} label="Bookmark" />
            <IconChip icon={Notification01Icon} label="Notification" />
            <IconChip icon={CheckmarkCircle01Icon} label="Success" />
            <IconChip icon={Alert01Icon} label="Alert" />
            <IconChip icon={InformationCircleIcon} label="Info" />
            <IconChip icon={RepeatIcon} label="Repeat" />
          </div>
        </div>
      </div>
    ),
  },
];

const componentSections: { label: string; icon: any; content?: ReactNode }[] = [
  {
    label: "Accordion",
    icon: ArrowDown01Icon,
    content: <AccordionDemo />,
  },
  {
    label: "Alert",
    icon: Alert01Icon,
    content: (
      <DemoBox>
        <StateRow label="Default">
          <div className="w-full"><Alert><HugeiconsIcon icon={InformationCircleIcon} size={16} /><AlertTitle>Heads up</AlertTitle><AlertDescription>You can add components to your app.</AlertDescription></Alert></div>
        </StateRow>
        <StateRow label="Destructive">
          <div className="w-full"><Alert variant="destructive"><HugeiconsIcon icon={Alert01Icon} size={16} /><AlertTitle>Error</AlertTitle><AlertDescription>Your session has expired. Please sign in again.</AlertDescription></Alert></div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Alert Dialog",
    icon: AlertCircleIcon,
    content: <AlertDialogDemo />,
  },
  {
    label: "Animated Input",
    icon: Loading03Icon,
    content: <OverlayNote text="animated-input.tsx re-exports the Accordion primitives. See Accordion for states." />,
  },
  {
    label: "App Input",
    icon: InputTextIcon,
    content: <AppInputDemo />,
  },
  {
    label: "Aspect Ratio",
    icon: AspectRatioIcon,
    content: (
      <DemoBox>
        <StateRow label="16 / 9">
          <div className="w-48 overflow-hidden rounded-lg bg-[#D1FAE5]" style={{ aspectRatio: "16/9" }} />
        </StateRow>
        <StateRow label="4 / 3">
          <div className="w-48 overflow-hidden rounded-lg bg-[#E7FFF5]" style={{ aspectRatio: "4/3" }} />
        </StateRow>
        <StateRow label="1 / 1 (square)">
          <div className="w-24 overflow-hidden rounded-lg bg-[#D1FAE5]" style={{ aspectRatio: "1/1" }} />
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Avatar",
    icon: UserIcon,
    content: (
      <DemoBox>
        <StateRow label="With Image">
          <Avatar><AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" /><AvatarFallback>CN</AvatarFallback></Avatar>
        </StateRow>
        <StateRow label="Fallback (no image)">
          <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
          <Avatar><AvatarFallback>KR</AvatarFallback></Avatar>
          <Avatar><AvatarFallback>WF</AvatarFallback></Avatar>
        </StateRow>
        <StateRow label="Sizes (via className)">
          <Avatar className="h-6 w-6 text-xs"><AvatarFallback>S</AvatarFallback></Avatar>
          <Avatar><AvatarFallback>M</AvatarFallback></Avatar>
          <Avatar className="h-14 w-14 text-lg"><AvatarFallback>L</AvatarFallback></Avatar>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Badge",
    icon: CheckmarkBadge01Icon,
    content: (
      <DemoBox>
        {/* Trip Type badges */}
        <StateRow label="Trip Type">
          {/* One Way */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8" }}>
            <HugeiconsIcon icon={ArrowRight04Icon} size={10} color="#1D4ED8" strokeWidth={2.5} />
            One Way
          </div>
          {/* Round Trip */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8" }}>
            <HugeiconsIcon icon={CircleArrowReload01Icon} size={10} color="#1D4ED8" strokeWidth={2.5} />
            Round Trip
          </div>
          {/* Day Trip */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8" }}>
            <HugeiconsIcon icon={SunCloud01Icon} size={10} color="#1D4ED8" strokeWidth={2.5} />
            Day Trip
          </div>
          {/* Multi Day */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8" }}>
            <HugeiconsIcon icon={MapPinpoint01Icon} size={10} color="#1D4ED8" strokeWidth={2.5} />
            Multi Day
          </div>
        </StateRow>

        {/* Status badges */}
        <StateRow label="Status Badges">
          {/* GoWild */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#4A7C59", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={Rocket01Icon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            GoWild
          </div>
          {/* Blackout */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#111827", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={UnavailableIcon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            Blackout
          </div>
          {/* Cheapest */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#1E3A5F", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={DollarCircleIcon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            Cheapest
          </div>
          {/* Quickest */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#D4AF37", color: "#1A1A1A" }}>
            <HugeiconsIcon icon={TrafficLightIcon} size={10} color="#1A1A1A" strokeWidth={2.5} />
            Quickest
          </div>
          {/* +1 Day */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#E89830", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={Clock01Icon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            +1 Day
          </div>
          {/* Red Eye */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#DC2626", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={Alert01Icon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            Red Eye
          </div>
          {/* Best Balance */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#7C3AED", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={ArrowDown01Icon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            Best Balance
          </div>
          {/* Longest Time There */}
          <div className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#D97706", color: "#FFFFFF" }}>
            <HugeiconsIcon icon={MapPinpoint01Icon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            Longest Time There
          </div>
        </StateRow>

        {/* Price badges */}
        <StateRow label="Price Badge — Light">
          <div
            className="inline-flex flex-col items-end rounded-full px-6 py-3"
            style={{ background: "#FFFFFF", border: "2px solid #1E2D5A", boxShadow: "0 2px 8px rgba(30,45,90,0.10)" }}
          >
            <span className="text-xs font-semibold leading-none" style={{ color: "#1E2D5A" }}>From</span>
            <span className="text-3xl font-black leading-tight tracking-tight" style={{ color: "#1E2D5A" }}>$213.50</span>
          </div>
        </StateRow>

        <StateRow label="Price Badge — GoWild">
          <div
            className="inline-flex flex-col items-end rounded-full px-6 py-3"
            style={{ background: "#4A7C59", border: "2px solid #FFFFFF", boxShadow: "0 2px 8px rgba(74,124,89,0.25)" }}
          >
            <span className="text-xs font-semibold leading-none text-white/80">From</span>
            <span className="text-3xl font-black leading-tight tracking-tight text-white">GoWild</span>
          </div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Breadcrumb",
    icon: Navigation01Icon,
    content: (
      <DemoBox>
        <StateRow label="Default">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="#">Flights</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Results</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Button",
    icon: Cursor01Icon,
    content: (
      <DemoBox>
        <StateRow label="App Primary (used throughout app — Log In, Search Flights, etc.)">
          <button className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-6">
            <span className="uppercase tracking-[0.35em]">Log In</span>
            <HugeiconsIcon icon={Airplane01Icon} size={18} color="white" strokeWidth={2} />
          </button>
        </StateRow>
        <StateRow label="App Primary — Disabled">
          <button disabled className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 px-6 opacity-50 cursor-not-allowed">
            <span className="uppercase tracking-[0.35em]">Log In</span>
          </button>
        </StateRow>
        <StateRow label="Variants">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </StateRow>
        <StateRow label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><HugeiconsIcon icon={Search01Icon} size={16} /></Button>
        </StateRow>
        <StateRow label="Disabled">
          <Button disabled>Default</Button>
          <Button variant="secondary" disabled>Secondary</Button>
          <Button variant="outline" disabled>Outline</Button>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Calendar",
    icon: Calendar03Icon,
    content: <OverlayNote text="Calendar renders a full month picker. States: Default (current month), Focused (date highlighted), Selected (date chosen), Disabled (dates blocked), Range selection." />,
  },
  {
    label: "Card",
    icon: Cards01Icon,
    content: (
      <div className="space-y-3">
        <DemoBox>
          <StateRow label="Full anatomy (shadcn Card)">
            <Card className="w-full max-w-xs">
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description goes here.</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Card content area.</p></CardContent>
              <CardFooter><Button size="sm">Action</Button></CardFooter>
            </Card>
          </StateRow>
          <StateRow label="Content only (shadcn Card)">
            <Card className="w-full max-w-xs"><CardContent className="pt-6"><p className="text-sm">Minimal card with content only.</p></CardContent></Card>
          </StateRow>
        </DemoBox>
        <FlightCardDemo />
        <DestCardDemo />
      </div>
    ),
  },
  {
    label: "Carousel",
    icon: ArrowLeftRightIcon,
    content: <OverlayNote text="Carousel wraps embla-carousel. States: Default (first slide visible), Next (navigated forward), Previous (navigated back), Loop (wraps around), Autoplay." />,
  },
  {
    label: "Chart",
    icon: BarChartIcon,
    content: <OverlayNote text="Chart wraps Recharts. Types: Bar, Line, Area, Pie, Radar. States: Default, Tooltip (hover), Legend toggled, Responsive (resize)." />,
  },
  {
    label: "Checkbox",
    icon: CheckmarkSquare01Icon,
    content: <CheckboxDemo />,
  },
  {
    label: "Chip",
    icon: Tag01Icon,
    content: (
      <DemoBox>
        <StateRow label="Recent Airport (Select Airport sheet)">
          <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1">
            {[
              { iata: "DEN", city: "Denver" },
              { iata: "MIA", city: "Miami" },
              { iata: "LAX", city: "Los Angeles" },
              { iata: "ORD", city: "Chicago" },
            ].map((a) => (
              <button
                key={a.iata}
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold shrink-0 whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                  color: "#065F46",
                  border: "1px solid #6EE7B7",
                }}
              >
                <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={12} color="#059669" strokeWidth={2.5} />
                <span className="font-bold">{a.iata}</span>
                <span className="opacity-60 font-medium">{a.city}</span>
              </button>
            ))}
          </div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Collapsible",
    icon: MenuCollapseIcon,
    content: <CollapsibleDemo />,
  },
  {
    label: "Command",
    icon: CommandIcon,
    content: <OverlayNote text="Command renders a searchable list (cmdk). States: Default (empty input), Typing (filtered results), Item focused, Item selected, No results." />,
  },
  {
    label: "Context Menu",
    icon: MouseRightClick01Icon,
    content: <OverlayNote text="Context Menu opens on right-click. States: Closed (default), Open (right-click trigger), Item highlighted, Item with submenu, Item disabled, Item with separator." />,
  },
  {
    label: "Date Picker",
    icon: Calendar03Icon,
    content: <DatePickerDemo />,
  },
  {
    label: "Dialog",
    icon: MessagePreview01Icon,
    content: <OverlayNote text="Dialog renders a modal overlay. States: Closed (default), Open (triggered), With form, With scroll, Dismissible (click outside or Escape)." />,
  },
  {
    label: "Drawer",
    icon: SidebarLeft01Icon,
    content: <OverlayNote text="Drawer slides up from the bottom (vaul). States: Closed (default), Open (triggered), Dragging (partial), Snapped (snap point). Directions: bottom, top, left, right." />,
  },
  {
    label: "Dropdown Menu",
    icon: ListViewIcon,
    content: <OverlayNote text="Dropdown Menu opens on trigger click. States: Closed (default), Open, Item highlighted, Item disabled, Item with checkbox, Item with radio group, Sub-menu open." />,
  },
  {
    label: "Feedback",
    icon: Notification01Icon,
  },
  {
    label: "Form",
    icon: FileEditIcon,
    content: <OverlayNote text="Form wraps react-hook-form with Zod. States: Default, Focused field, Validation error (inline), Success (submitted), Submitting (loading)." />,
  },
  {
    label: "Hover Card",
    icon: MouseLeftClick01Icon,
    content: <OverlayNote text="Hover Card opens on mouse-over. States: Closed (default), Open (hover trigger), With delay, With image/rich content." />,
  },
  {
    label: "Input",
    icon: InputTextIcon,
    content: (
      <DemoBox>
        <StateRow label="Default"><Input placeholder="Placeholder text" className="max-w-xs" /></StateRow>
        <StateRow label="With value"><Input defaultValue="Entered value" className="max-w-xs" /></StateRow>
        <StateRow label="Focused (click to see)"><Input placeholder="Click to focus" className="max-w-xs" /></StateRow>
        <StateRow label="Disabled"><Input placeholder="Disabled input" disabled className="max-w-xs" /></StateRow>
        <StateRow label="Type: password"><Input type="password" defaultValue="secret" className="max-w-xs" /></StateRow>
        <StateRow label="Type: number"><Input type="number" placeholder="0" className="max-w-xs" /></StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Input Otp",
    icon: LockPasswordIcon,
    content: <OverlayNote text="Input OTP renders segmented one-time password fields (input-otp). States: Empty, Partial fill, Complete (all digits entered), Error, Disabled." />,
  },
  {
    label: "Label",
    icon: LabelIcon,
    content: (
      <DemoBox>
        <StateRow label="Input Label">
          <div className="flex flex-col gap-3 w-full">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-1">Default (unfocused)</p>
              <p className="text-sm font-semibold text-[#6B7B7B] ml-1">Departure Airport</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#93A8A7] mb-1">Focused</p>
              <p className="text-sm font-semibold text-[#10B981] ml-1">Departure Airport</p>
            </div>
          </div>
        </StateRow>
        <StateRow label="Listing Label">
          <p className="block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase">Recent Airports</p>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Menubar",
    icon: Menu02Icon,
    content: <OverlayNote text="Menubar renders a horizontal menu (File / Edit / View style). States: Default, Item open, Sub-menu open, Item highlighted, Item disabled, Item with shortcut." />,
  },
  {
    label: "Multi Select",
    icon: CheckListIcon,
  },
  {
    label: "Navigation Menu",
    icon: Navigation01Icon,
    content: <OverlayNote text="Navigation Menu renders a top-nav with flyout panels. States: Default, Item hovered (viewport open), Link active (current page), Item focused (keyboard)." />,
  },
  {
    label: "Pagination",
    icon: Files01Icon,
    content: (
      <DemoBox>
        <StateRow label="Default (page 3 of 10)">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="outline" size="sm">«</Button>
            <Button variant="outline" size="sm">‹</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button size="sm">3</Button>
            <Button variant="outline" size="sm">4</Button>
            <Button variant="outline" size="sm">›</Button>
            <Button variant="outline" size="sm">»</Button>
          </div>
        </StateRow>
        <StateRow label="First page (prev disabled)">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="outline" size="sm" disabled>«</Button>
            <Button variant="outline" size="sm" disabled>‹</Button>
            <Button size="sm">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">›</Button>
            <Button variant="outline" size="sm">»</Button>
          </div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Popover",
    icon: Message01Icon,
    content: <OverlayNote text="Popover floats near its trigger. States: Closed (default), Open (triggered), With form content, With arrow. Sides: top, bottom, left, right." />,
  },
  {
    label: "Progress",
    icon: Progress01Icon,
    content: (
      <DemoBox>
        <StateRow label="0%"><Progress value={0} className="w-full" /></StateRow>
        <StateRow label="33%"><Progress value={33} className="w-full" /></StateRow>
        <StateRow label="66%"><Progress value={66} className="w-full" /></StateRow>
        <StateRow label="100%"><Progress value={100} className="w-full" /></StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Radio Group",
    icon: RadioButtonIcon,
    content: <RadioGroupDemo />,
  },
  {
    label: "Resizable",
    icon: Resize01Icon,
    content: <OverlayNote text="Resizable wraps react-resizable-panels. States: Default (initial split), Dragging handle, Collapsed panel, Expanded panel. Directions: horizontal, vertical." />,
  },
  {
    label: "Scroll Area",
    icon: ScrollVerticalIcon,
    content: (
      <DemoBox>
        <StateRow label="Vertical scroll">
          <ScrollArea className="h-32 w-full rounded-md border p-3">
            {Array.from({ length: 12 }, (_, i) => (
              <p key={i} className="text-xs text-[#6B7B7B] py-0.5">Item {i + 1}</p>
            ))}
          </ScrollArea>
        </StateRow>
        <StateRow label="Horizontal scroll">
          <ScrollArea className="w-full whitespace-nowrap rounded-md border p-3">
            <div className="flex gap-4">
              {Array.from({ length: 15 }, (_, i) => (
                <div key={i} className="shrink-0 rounded bg-[#D1FAE5] px-3 py-1 text-xs text-[#059669]">Tag {i + 1}</div>
              ))}
            </div>
          </ScrollArea>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Searchbox",
    icon: Search01Icon,
  },
  {
    label: "Select",
    icon: Select01Icon,
    content: (
      <DemoBox>
        <StateRow label="Default (closed)">
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Select option" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
              <SelectItem value="c">Option C</SelectItem>
            </SelectContent>
          </Select>
        </StateRow>
        <StateRow label="With value selected">
          <Select defaultValue="b">
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
              <SelectItem value="c">Option C</SelectItem>
            </SelectContent>
          </Select>
        </StateRow>
        <StateRow label="Disabled">
          <Select disabled>
            <SelectTrigger className="w-40"><SelectValue placeholder="Disabled" /></SelectTrigger>
            <SelectContent><SelectItem value="x">X</SelectItem></SelectContent>
          </Select>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Separator",
    icon: DivideSignIcon,
    content: (
      <DemoBox>
        <StateRow label="Horizontal">
          <div className="w-full space-y-2">
            <p className="text-xs text-[#6B7B7B]">Above</p>
            <Separator orientation="horizontal" />
            <p className="text-xs text-[#6B7B7B]">Below</p>
          </div>
        </StateRow>
        <StateRow label="Vertical">
          <div className="flex items-center gap-3 h-8">
            <span className="text-xs text-[#6B7B7B]">Left</span>
            <Separator orientation="vertical" className="h-full" />
            <span className="text-xs text-[#6B7B7B]">Right</span>
          </div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Sheet",
    icon: SidebarRightIcon,
    content: <OverlayNote text="Sheet slides in from the edge of the screen. States: Closed (default), Open (triggered). Sides: top, bottom, left, right. With form, With scroll." />,
  },
  {
    label: "Sidebar",
    icon: SidebarLeftIcon,
    content: <OverlayNote text="Sidebar provides a collapsible app sidebar (shadcn sidebar). States: Expanded, Collapsed (icon-only), Mobile (sheet variant), Over content, Push content." />,
  },
  {
    label: "Skeleton",
    icon: Loading01Icon,
    content: (
      <DemoBox>
        <StateRow label="Text lines">
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </StateRow>
        <StateRow label="Avatar + text (loading card)">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </StateRow>
        <StateRow label="Image placeholder">
          <Skeleton className="h-32 w-full rounded-xl" />
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Slider",
    icon: SlidersHorizontalIcon,
    content: (
      <DemoBox>
        <StateRow label="Default (0%)"><Slider defaultValue={[0]} max={100} step={1} className="w-full" /></StateRow>
        <StateRow label="Mid value (50%)"><Slider defaultValue={[50]} max={100} step={1} className="w-full" /></StateRow>
        <StateRow label="High value (80%)"><Slider defaultValue={[80]} max={100} step={1} className="w-full" /></StateRow>
        <StateRow label="Disabled"><Slider defaultValue={[40]} max={100} step={1} disabled className="w-full" /></StateRow>
        <StateRow label="Range (two thumbs)"><Slider defaultValue={[20, 70]} max={100} step={1} className="w-full" /></StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Sonner",
    icon: Notification03Icon,
    content: <OverlayNote text="Sonner renders toast notifications via the <Toaster /> provider. Types: Default, Success, Error, Warning, Info, Loading, Custom (with JSX). States: Entering, Visible, Dismissing." />,
  },
  {
    label: "Switch",
    icon: ToggleOnIcon,
    content: <TripTypeSwitchDemo />,
  },
  {
    label: "Table",
    icon: Table01Icon,
    content: (
      <DemoBox>
        <StateRow label="Default">
          <div className="w-full">
            <Table>
              <TableCaption>A list of recent flights.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">JFK → LAX</TableCell>
                  <TableCell>Mar 20</TableCell>
                  <TableCell><Badge variant="secondary">On time</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">LAX → ORD</TableCell>
                  <TableCell>Mar 22</TableCell>
                  <TableCell><Badge variant="destructive">Delayed</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">ORD → MIA</TableCell>
                  <TableCell>Mar 25</TableCell>
                  <TableCell><Badge>Confirmed</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Tabs",
    icon: LayoutTopIcon,
    content: <TabsDemo />,
  },
  {
    label: "Textarea",
    icon: NoteEditIcon,
    content: (
      <DemoBox>
        <StateRow label="Default"><Textarea placeholder="Type your message…" className="max-w-xs" /></StateRow>
        <StateRow label="With value"><Textarea defaultValue="Pre-filled content here." className="max-w-xs" /></StateRow>
        <StateRow label="Focused (click to see)"><Textarea placeholder="Click to focus" className="max-w-xs" /></StateRow>
        <StateRow label="Disabled"><Textarea placeholder="Disabled textarea" disabled className="max-w-xs" /></StateRow>
      </DemoBox>
    ),
  },
  {
    label: "Toast",
    icon: Notification01Icon,
    content: <OverlayNote text="Toast renders ephemeral notifications (shadcn toast). Variants: Default, Destructive. States: Entering (slide-in), Visible, Dismissed (swipe or timeout)." />,
  },
  {
    label: "Toaster",
    icon: Notification02Icon,
    content: <OverlayNote text="Toaster is the root <Toaster /> provider that renders all active toasts. It is placed once at the app root. States are managed by the useToast hook." />,
  },
  {
    label: "Toggle",
    icon: ToggleOnIcon,
    content: <AuthToggleDemo />,
  },
  {
    label: "Toggle Group",
    icon: ToggleOffIcon,
    content: <ToggleGroupDemo />,
  },
  {
    label: "Tooltip",
    icon: HelpCircleIcon,
    content: <OverlayNote text="Tooltip appears on hover/focus. States: Hidden (default), Visible (hovered or focused), Delayed open, Persistent (click to keep open). Sides: top, bottom, left, right." />,
  },
  {
    label: "Use Toast",
    icon: Notification01Icon,
    content: <OverlayNote text="useToast is a hook that returns { toast, dismiss, toasts }. It programmatically fires Toast notifications. Not a visual component itself." />,
  },
];

function CollapsibleRow({
  label,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center w-full px-5 py-3.5 gap-3 hover:bg-[#F8FBFB] transition-colors text-left"
      >
        <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={15} color="#345C5A" strokeWidth={1.5} />
        </span>
        <span className="flex-1 text-sm font-semibold text-[#2E4A4A]">{label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          color="#C4CACA"
          strokeWidth={1.5}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-4 pt-1 animate-fade-in">
          {children ?? (
            <div className="rounded-xl bg-[#F8FBFB] border border-[#EEF2F1] px-4 py-3">
              <p className="text-xs text-[#8C9F9E]">Documentation and examples coming soon.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DesignSystemPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5 px-4 pb-24 pt-3 sm:px-5">
      {/* Hero card */}
      <div
        className={cn(surfaceClass, "overflow-hidden")}
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBFB 100%)",
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
            <HugeiconsIcon icon={InformationCircleIcon} size={18} className="mt-0.5 text-[#059669]" />
            <AlertTitle>What to look for while reviewing</AlertTitle>
            <AlertDescription className="text-[#486766]">
              Compare radius, spacing, label tone, icon sizing, focus treatment, badge shape, and the hierarchy of primary vs.
              supporting information.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Tokens section */}
      <div className="bg-white rounded-[28px] border border-[#E7ECEC] shadow-[0_18px_40px_rgba(21,41,40,0.08)] overflow-hidden">
        <div className="border-b border-[#EEF3F2] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold tracking-tight text-[#173433]">Tokens, typography, and icon language</h2>
          <p className="mt-1 text-sm text-[#67807E]">A quick read on color, hierarchy, and the visual voice already living in Wildfly.</p>
        </div>
        <div className="divide-y divide-[#F0F2F2]">
          {tokenSections.map(({ label, icon, content }) => (
            <CollapsibleRow
              key={`token-${label}`}
              label={label}
              icon={icon}
              isOpen={openSections.has(`token-${label}`)}
              onToggle={() => toggleSection(`token-${label}`)}
            >
              {content}
            </CollapsibleRow>
          ))}
        </div>
      </div>

      {/* Component sections */}
      <div className="bg-white rounded-[28px] border border-[#E7ECEC] shadow-[0_18px_40px_rgba(21,41,40,0.08)] overflow-hidden">
        <div className="border-b border-[#EEF3F2] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold tracking-tight text-[#173433]">Components</h2>
          <p className="mt-1 text-sm text-[#67807E]">Expand any component to view its documentation and examples.</p>
        </div>
        <div className="divide-y divide-[#F0F2F2]">
          {componentSections.map(({ label, icon, content }) => (
            <CollapsibleRow
              key={`component-${label}`}
              label={label}
              icon={icon}
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
