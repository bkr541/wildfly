import { useEffect, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Rocket01Icon,
  Clock01Icon,
  Money03Icon,
  Tag01Icon,
  CalendarRemove02Icon,
  AirplaneSeatIcon,
  Route02Icon,
  HelpCircleIcon,
  GlobeIcon,
  Calendar01Icon,
  BookOpen01Icon,
  GiftIcon,
  UserMultipleIcon,
  AlertCircleIcon,
  InformationCircleIcon,
  ArrowUpRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  AirportIcon,
} from "@hugeicons/core-free-icons";
import { GuideSectionCard } from "@/components/gowild-guide/GuideSectionCard";
import { BookingWindowCalculator } from "@/components/gowild-guide/BookingWindowCalculator";
import { FareDecoder } from "@/components/gowild-guide/FareDecoder";
import { BlackoutCalendar } from "@/components/gowild-guide/BlackoutCalendar";
import { GoWildTroubleshooter } from "@/components/gowild-guide/GoWildTroubleshooter";
import { GoWildFaq } from "@/components/gowild-guide/GoWildFaq";
import { FareBreakdownExample } from "@/components/gowild-guide/FareBreakdownExample";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EARLY_BOOKING_PROMOTION,
  LAST_VERIFIED_DATE,
  PASS_TRAVEL_PERIODS,
  QUICK_POINTS,
  RESOURCE_LINKS,
} from "@/data/gowildGuideContent";

const PAGE_TITLE = "GoWild Guide: Booking Windows, Prices, Blackout Dates and FAQs | Wildfly";
const PAGE_DESCRIPTION =
  "Learn when Frontier GoWild fares become available, why prices may exceed $15, how early-booking charges and blackout dates work, and how to troubleshoot missing GoWild availability.";
const CANONICAL_URL = "https://wildfly.app/gowild-guide";

/** Tiny same-file helper to manage <head> tags without adding a SEO dependency. */
function usePageMetadata() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;

    const ensure = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      let created = false;
      if (!el) {
        el = create();
        document.head.appendChild(el);
        created = true;
      }
      return { el, created };
    };

    const items: Array<{ el: HTMLElement; created: boolean; prev?: string | null; attr?: string }> = [];

    // description
    {
      const { el, created } = ensure(
        'meta[name="description"]',
        () => Object.assign(document.createElement("meta"), { name: "description" }),
      );
      items.push({ el, created, prev: el.getAttribute("content"), attr: "content" });
      el.setAttribute("content", PAGE_DESCRIPTION);
    }

    // canonical
    {
      const { el, created } = ensure(
        'link[rel="canonical"]',
        () => Object.assign(document.createElement("link"), { rel: "canonical" }),
      );
      items.push({ el, created, prev: el.getAttribute("href"), attr: "href" });
      el.setAttribute("href", CANONICAL_URL);
    }

    // og:title
    {
      const { el, created } = ensure('meta[property="og:title"]', () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:title");
        return m;
      });
      items.push({ el, created, prev: el.getAttribute("content"), attr: "content" });
      el.setAttribute("content", PAGE_TITLE);
    }

    // og:description
    {
      const { el, created } = ensure('meta[property="og:description"]', () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:description");
        return m;
      });
      items.push({ el, created, prev: el.getAttribute("content"), attr: "content" });
      el.setAttribute("content", PAGE_DESCRIPTION);
    }

    // og:url
    {
      const { el, created } = ensure('meta[property="og:url"]', () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:url");
        return m;
      });
      items.push({ el, created, prev: el.getAttribute("content"), attr: "content" });
      el.setAttribute("content", CANONICAL_URL);
    }

    return () => {
      document.title = prevTitle;
      for (const it of items) {
        if (it.created) it.el.remove();
        else if (it.attr) {
          if (it.prev !== null && it.prev !== undefined) it.el.setAttribute(it.attr, it.prev);
        }
      }
    };
  }, []);
}

interface NavItem {
  id: string;
  label: string;
  icon: IconSvgElement;
}
const NAV: NavItem[] = [
  { id: "quick-start", label: "Quick Start", icon: Rocket01Icon },
  { id: "booking-window", label: "Booking Window", icon: Clock01Icon },
  { id: "fare-pricing", label: "Fare Pricing", icon: Money03Icon },
  { id: "early-booking", label: "Early Booking", icon: Tag01Icon },
  { id: "blackout", label: "Blackout Dates", icon: CalendarRemove02Icon },
  { id: "availability", label: "Availability", icon: AirplaneSeatIcon },
  { id: "travel-rules", label: "Travel Rules", icon: Route02Icon },
  { id: "troubleshooter", label: "Troubleshooter", icon: HelpCircleIcon },
  { id: "faq", label: "FAQ", icon: BookOpen01Icon },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HeroPrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold",
        "px-6 py-3 min-h-[48px] text-sm uppercase tracking-wider",
        "shadow-[0_8px_24px_-8px_rgba(5,150,105,0.45)] active:scale-[0.98] transition-transform",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: IconSvgElement;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F0F1F1] bg-white p-4 shadow-sm">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: "#F0FDF4" }}
      >
        <HugeiconsIcon icon={icon} size={22} color="#059669" strokeWidth={2} />
      </div>
      <p className="text-sm font-bold text-[#1A2E2E] leading-snug">{title}</p>
      <p className="text-xs text-[#6B7B7B] leading-relaxed mt-1">{description}</p>
    </div>
  );
}

export default function GoWildGuidePage() {
  usePageMetadata();

  const promoVisible = useMemo(() => {
    if (!EARLY_BOOKING_PROMOTION.active) return false;
    const todayIso = new Date().toISOString().slice(0, 10);
    return todayIso <= EARLY_BOOKING_PROMOTION.purchaseThrough;
  }, []);

  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 40%, #BBF7D0 75%, #A7F3D0 100%)",
        }}
      >
        <div className="relative">
          <div className="max-w-2xl mx-auto px-5 pt-10 pb-14 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <div className="flex flex-col items-center text-center">
              <img
                src="/assets/logo/logo_horizontal.png"
                alt="Wildfly"
                className="h-9 w-auto mb-3"
                loading="eager"
              />
              <img
                src="/assets/logo/tag_noshadow.png"
                alt=""
                aria-hidden="true"
                className="h-5 w-auto mb-6 opacity-90"
              />
              <h1
                className="text-[#1A2E2E] font-black leading-[1.05] text-3xl sm:text-4xl tracking-tight"
              >
                GoWild Guide
              </h1>
              <p className="text-[#6B7B7B] text-sm sm:text-base leading-relaxed mt-3 max-w-md">
                Everything you need to understand booking windows, fare prices, availability,
                blackout dates, and using your Frontier GoWild Pass.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <HeroPrimaryButton onClick={() => scrollToSection("booking-window")}>
                  Check My Booking Window
                </HeroPrimaryButton>
                <HeroPrimaryButton onClick={() => scrollToSection("blackout")}>
                  View Blackout Dates
                </HeroPrimaryButton>
              </div>
              <p className="text-[11px] text-[#6B7B7B] mt-5">
                Last verified with Frontier:{" "}
                <span className="font-semibold text-[#1A2E2E]">
                  {new Date(`${LAST_VERIFIED_DATE}T00:00:00Z`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </p>
              <p className="text-[11px] text-[#6B7B7B] max-w-md mt-2 leading-relaxed">
                Wildfly is not affiliated with or endorsed by Frontier Airlines. Frontier's
                current terms, availability, and final checkout price control.
              </p>
            </div>

            {/* Benefit cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
              <BenefitCard
                icon={Clock01Icon}
                title="Know When to Book"
                description="Origin-timezone aware countdown for the standard booking window."
              />
              <BenefitCard
                icon={Money03Icon}
                title="Understand Your Fare"
                description="See why your GoWild total may differ from the $0.01 airfare."
              />
              <BenefitCard
                icon={CalendarRemove02Icon}
                title="Check Blackout Dates"
                description="Browse blackout periods month-by-month with accessible labels."
              />
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div
        style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
        className="pb-16"
      >
        {/* Sticky section navigator */}
        <nav
          aria-label="GoWild Guide sections"
          className="sticky top-0 z-30 bg-[#F2F3F3]/85 backdrop-blur-md border-b border-[#E8EBEB]"
        >
          <div className="max-w-2xl mx-auto px-2">
            <div className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => scrollToSection(n.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E8EBEB] text-[#2E4A4A] hover:border-[#10B981] hover:text-[#059669] px-3 py-1.5 text-xs font-semibold min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                >
                  <HugeiconsIcon icon={n.icon} size={14} color="currentColor" strokeWidth={2} />
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto w-full px-4 pt-5 space-y-4">
          {/* Quick Start */}
          <GuideSectionCard
            id="quick-start"
            icon={Rocket01Icon}
            title="GoWild in 30 Seconds"
            subtitle="The most important rules at a glance."
          >
            <ul className="space-y-2">
              {QUICK_POINTS.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2 rounded-xl border border-[#E8EBEB] bg-white px-3 py-2"
                >
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "#F0FDF4" }}
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={16}
                      color="#059669"
                      strokeWidth={2}
                    />
                  </div>
                  <p className="text-sm text-[#2E4A4A] leading-snug">{p}</p>
                </li>
              ))}
            </ul>
          </GuideSectionCard>

          {/* Booking Window */}
          <GuideSectionCard
            id="booking-window"
            icon={Clock01Icon}
            title="Booking Window Calculator"
            subtitle="See when GoWild fares should open in the origin's local time."
          >
            <BookingWindowCalculator />
          </GuideSectionCard>

          {/* Fare Pricing */}
          <GuideSectionCard
            id="fare-pricing"
            icon={Money03Icon}
            title="Fare Anatomy"
            subtitle="What makes up your displayed GoWild total."
          >
            <FareBreakdownExample />
          </GuideSectionCard>

          <GuideSectionCard
            icon={HelpCircleIcon}
            title="Fare Decoder"
            subtitle="A best-guess explanation for the price you see."
          >
            <FareDecoder />
          </GuideSectionCard>

          <GuideSectionCard
            icon={InformationCircleIcon}
            title="How to Inspect the Exact Fare"
          >
            <ol className="space-y-2 text-sm text-[#2E4A4A] list-decimal pl-5">
              <li>Select the GoWild fare.</li>
              <li>Open the cart or trip summary.</li>
              <li>Expand <em>Taxes and Carrier Imposed Fees</em>.</li>
              <li>
                Look for: GoWild Early Booking · Transportation Tax · Domestic Flight Segment Tax ·
                Passenger Security Fee · Passenger Facility Charge · International arrival/departure taxes.
              </li>
              <li>Compare the final GoWild total with Standard and Discount Den.</li>
            </ol>
            <div className="mt-3 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
              GoWild is not guaranteed to be the cheapest fare in every search.
            </div>
          </GuideSectionCard>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Around $15",
                body: "Usually a domestic nonstop inside the normal booking window — mostly the $0.01 airfare plus required taxes and charges.",
              },
              {
                title: "Around $30+",
                body: "May indicate a connecting itinerary, multiple segments, territory routing, or another itinerary-specific charge.",
              },
              {
                title: "$59 / $79 / $119+",
                body: "May indicate a GoWild Early Booking charge, peak-date promotion, multiple segments, international taxes, or optional add-ons.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-[#F0F1F1] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#059669]">{c.title}</p>
                <p className="text-xs text-[#6B7B7B] leading-relaxed mt-1">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Early Booking */}
          <GuideSectionCard
            id="early-booking"
            icon={Tag01Icon}
            title="Early Booking"
            subtitle="When GoWild appears outside the standard window."
          >
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Frontier may release select GoWild fares beyond the normal booking window.</li>
              <li>These fares may include a non-refundable early-booking charge.</li>
              <li>The GoWild total may therefore be higher than Standard or Discount Den.</li>
              <li>Early-booking inventory remains capacity-controlled.</li>
              <li>A flight unavailable through early booking may still appear when the standard window opens.</li>
              <li>An early-booking charge is not a universal blackout-date fee.</li>
            </ul>
            {promoVisible && (
              <div className="mt-3 rounded-xl border border-[#A7F3D0] bg-[#F0FDF4] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#059669] flex items-center gap-1.5">
                  <HugeiconsIcon icon={GiftIcon} size={14} color="#059669" strokeWidth={2} />
                  {EARLY_BOOKING_PROMOTION.title}
                </p>
                <p className="text-sm text-[#1A2E2E] mt-1">{EARLY_BOOKING_PROMOTION.message}</p>
                <p className="text-xs text-[#6B7B7B] mt-1">
                  Purchase through {EARLY_BOOKING_PROMOTION.purchaseThrough} · Travel through{" "}
                  {EARLY_BOOKING_PROMOTION.travelThrough}.
                </p>
              </div>
            )}
          </GuideSectionCard>

          {/* Blackout */}
          <GuideSectionCard
            id="blackout"
            icon={CalendarRemove02Icon}
            title="Blackout Dates"
            subtitle="Months where standard GoWild redemption is normally restricted."
          >
            <BlackoutCalendar />
          </GuideSectionCard>

          {/* Availability */}
          <GuideSectionCard
            id="availability"
            icon={AirplaneSeatIcon}
            title="Why Standard May Show When GoWild Doesn't"
          >
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Standard, Discount Den, Miles, and GoWild are separate fare products.</li>
              <li>GoWild inventory is limited and capacity-controlled.</li>
              <li>Frontier does not promise last-seat availability to GoWild passholders.</li>
              <li>A purchasable regular fare does not require Frontier to release a GoWild fare.</li>
              <li>Availability may change after cancellations or inventory adjustments.</li>
              <li>
                Travelers can check periodically but should not rely on GoWild for rigid or
                date-critical travel.
              </li>
            </ul>
            <p className="text-xs text-[#6B7B7B] mt-2">
              Overselling, inventory controls, demand, cancellations, and operational changes
              may be possible factors that Wildfly cannot verify.
            </p>
          </GuideSectionCard>

          <GuideSectionCard
            icon={AlertCircleIcon}
            title="Seat Map vs. Fare Availability"
          >
            <div className="rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-3 text-sm text-[#92400E] mb-3">
              An empty-looking seat map does not prove that a flight has GoWild space.
            </div>
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Confirmed travelers may not have selected seats before departure.</li>
              <li>The seat map shows assignments, not total unsold airline inventory.</li>
              <li>Seat-map availability should not be used to predict GoWild availability.</li>
            </ul>
            <div className="mt-4 grid grid-cols-6 gap-1.5" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 rounded-md border border-[#E8EBEB]"
                  style={{ background: i % 5 === 0 ? "#F0FDF4" : "white" }}
                />
              ))}
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-2">
              Schematic only. Not a representation of any specific Frontier seat map.
            </p>
          </GuideSectionCard>

          {/* Travel Rules */}
          <GuideSectionCard
            id="travel-rules"
            icon={Route02Icon}
            title="Connections, Segments & Time Zones"
          >
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>A connecting itinerary contains multiple flight segments.</li>
              <li>Taxes and airport charges may apply across multiple segments.</li>
              <li>GoWild availability must support the complete itinerary Frontier offers.</li>
              <li>A second segment may depart after midnight or in another timezone.</li>
              <li>The first segment's departure date normally controls the itinerary date.</li>
              <li>Inspect the complete breakdown instead of assuming all connections cost the same.</li>
            </ul>
          </GuideSectionCard>

          <GuideSectionCard icon={GlobeIcon} title="Domestic, Territory & International">
            <Tabs defaultValue="domestic">
              <TabsList className="bg-[#F2F3F3]">
                <TabsTrigger value="domestic">Domestic</TabsTrigger>
                <TabsTrigger value="territory">PR / USVI</TabsTrigger>
                <TabsTrigger value="international">International</TabsTrigger>
              </TabsList>
              <TabsContent value="domestic" className="text-sm text-[#2E4A4A] mt-3">
                <ul className="list-disc pl-5 space-y-1">
                  <li>$0.01 base airfare per segment.</li>
                  <li>Taxes and airport charges apply.</li>
                  <li>Approximate totals are estimates.</li>
                  <li>Additional segments can increase the total.</li>
                </ul>
              </TabsContent>
              <TabsContent value="territory" className="text-sm text-[#2E4A4A] mt-3">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Generally use domestic booking-window rules.</li>
                  <li>Taxes and charges can be higher than continental itineraries.</li>
                  <li>Exact totals must be confirmed at checkout.</li>
                </ul>
              </TabsContent>
              <TabsContent value="international" className="text-sm text-[#2E4A4A] mt-3">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Normal booking window is 10 days.</li>
                  <li>Taxes may be significantly higher.</li>
                  <li>Passport, immigration, and onward-travel requirements may apply.</li>
                  <li>Return availability must be checked separately.</li>
                </ul>
              </TabsContent>
            </Tabs>
          </GuideSectionCard>

          <GuideSectionCard icon={AirportIcon} title="Included vs. Extra">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#E8EBEB] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-1.5">
                  Generally included
                </p>
                <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
                  <li>Personal item subject to Frontier's current restrictions</li>
                  <li>Confirmed reservation when GoWild inventory is available</li>
                  <li>Applicable benefits from eligible Frontier status</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#E8EBEB] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#92400E] mb-1.5">
                  Usually extra
                </p>
                <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
                  <li>Carry-on bag</li>
                  <li>Checked bag</li>
                  <li>Advance seat selection</li>
                  <li>Bundles</li>
                  <li>Priority services</li>
                  <li>Pets</li>
                  <li>Change or cancellation charges where applicable</li>
                </ul>
              </div>
            </div>
          </GuideSectionCard>

          <GuideSectionCard icon={Cancel01Icon} title="Changes, Cancellations & No-shows">
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Cancel before scheduled departure when you will not travel.</li>
              <li>Change and cancellation rules can vary.</li>
              <li>Optional products and early-booking charges may be non-refundable.</li>
              <li>Repeated no-shows can risk penalties or pass privileges.</li>
              <li>Check Frontier's current terms before changing a reservation.</li>
            </ul>
          </GuideSectionCard>

          <GuideSectionCard icon={AlertCircleIcon} title="Flight Cancellations & Disruptions">
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Check the reservation directly with Frontier.</li>
              <li>Review rebooking or refund options offered for that reservation.</li>
              <li>Contact Frontier support when automatic options are insufficient.</li>
              <li>Replacement GoWild availability may not appear through a normal search.</li>
              <li>Save confirmation details and receipts.</li>
              <li>Review Frontier's current Contract of Carriage and disruption policies.</li>
            </ul>
            <p className="text-xs text-[#6B7B7B] mt-2">
              Wildfly cannot promise hotels, meals, refunds, reimbursements, or rebooking outcomes.
            </p>
          </GuideSectionCard>

          <GuideSectionCard icon={UserMultipleIcon} title="Children & Multiple Travelers">
            <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
              <li>Each traveler generally needs their own eligible GoWild Pass.</li>
              <li>Every passholder needs a separate Frontier Miles account.</li>
              <li>Children may hold a pass subject to current age and account requirements.</li>
              <li>
                Children below Frontier's independent-travel age must travel with an eligible adult.
              </li>
              <li>A child without a pass generally cannot use another passenger's GoWild benefit.</li>
              <li>Every traveler in a multi-passenger GoWild booking must have valid eligibility.</li>
              <li>A search may fail when the passenger count exceeds available GoWild inventory.</li>
            </ul>
          </GuideSectionCard>

          <GuideSectionCard icon={Calendar01Icon} title="Pass Types & Renewal">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Annual Pass", "Summer Pass", "Monthly Pass"].map((name) => (
                <div key={name} className="rounded-xl border border-[#E8EBEB] bg-white p-3">
                  <p className="text-sm font-bold text-[#1A2E2E]">{name}</p>
                  <p className="text-xs text-[#6B7B7B] mt-1">
                    Eligible travel period, renewal price, and renewal behavior are set by Frontier
                    and may change. Manage automatic renewal inside the Frontier Miles account.
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-[#E8EBEB] bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-1.5">
                Known travel periods
              </p>
              <ul className="text-sm text-[#2E4A4A] space-y-1">
                {PASS_TRAVEL_PERIODS.map((p) => (
                  <li key={p.name}>
                    <span className="font-semibold">{p.name}:</span> {p.travelStart} → {p.travelEnd}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[#9CA3AF] mt-2">All dates and prices are subject to change.</p>
            </div>
          </GuideSectionCard>

          {/* Troubleshooter */}
          <GuideSectionCard
            id="troubleshooter"
            icon={HelpCircleIcon}
            title="Why Can't I See GoWild?"
            subtitle="Walk through the most common causes."
          >
            <GoWildTroubleshooter />
          </GuideSectionCard>

          <GuideSectionCard icon={BookOpen01Icon} title="Step-by-Step Booking Guide">
            <ol className="space-y-2 text-sm text-[#2E4A4A] list-decimal pl-5">
              <li>Sign into the correct Frontier Miles account.</li>
              <li>Search for the desired itinerary.</li>
              <li>Select GoWild when available.</li>
              <li>Compare GoWild, Standard, Discount Den, and Miles.</li>
              <li>Review Taxes and Carrier Imposed Fees.</li>
              <li>Review or decline bundles.</li>
              <li>Add bags and seats only when needed.</li>
              <li>Confirm every traveler's pass eligibility.</li>
              <li>Complete checkout and save the confirmation.</li>
              <li>Cancel before departure if no longer traveling.</li>
            </ol>
          </GuideSectionCard>

          {/* FAQ */}
          <GuideSectionCard
            id="faq"
            icon={BookOpen01Icon}
            title="Frequently Asked Questions"
            subtitle="Search to find an answer."
          >
            <GoWildFaq />
          </GuideSectionCard>

          {/* Official resources */}
          <GuideSectionCard icon={ArrowUpRight01Icon} title="Official Resources">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESOURCE_LINKS.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-[#E8EBEB] bg-white px-3 py-3 text-sm font-semibold text-[#1A2E2E] hover:border-[#10B981] hover:text-[#059669] flex items-center justify-between gap-2 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                >
                  <span>{r.label}</span>
                  <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} color="currentColor" strokeWidth={2} />
                </a>
              ))}
            </div>
            <p className="text-[11px] text-[#6B7B7B] mt-3">
              External links open in a new tab. Frontier's current terms always control.
            </p>
          </GuideSectionCard>
        </div>
      </div>
    </main>
  );
}
