import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Rocket01Icon,
  Menu03Icon,
  Home01Icon,
  ArrowLeft01Icon,
  Clock01Icon,
  Money03Icon,
  CalendarRemove02Icon,
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
import { BlackoutCalendar } from "@/components/gowild-guide/BlackoutCalendar";
import { GoWildFaq } from "@/components/gowild-guide/GoWildFaq";
import { PastGoWildFlights } from "@/components/gowild-guide/PastGoWildFlights";
import RoutesPage from "@/pages/Routes";
import {
  LAST_VERIFIED_DATE,
  PASS_TRAVEL_PERIODS,
  QUICK_POINTS,
  RESOURCE_LINKS,
} from "@/data/gowildGuideContent";

const PAGE_TITLE =
  "GoWild Guide: Booking Windows, Prices, Blackout Dates and FAQs | Wildfly";
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

    const items: Array<{
      el: HTMLElement;
      created: boolean;
      prev?: string | null;
      attr?: string;
    }> = [];

    // description
    {
      const { el, created } = ensure('meta[name="description"]', () =>
        Object.assign(document.createElement("meta"), { name: "description" }),
      );
      items.push({
        el,
        created,
        prev: el.getAttribute("content"),
        attr: "content",
      });
      el.setAttribute("content", PAGE_DESCRIPTION);
    }

    // canonical
    {
      const { el, created } = ensure('link[rel="canonical"]', () =>
        Object.assign(document.createElement("link"), { rel: "canonical" }),
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
      items.push({
        el,
        created,
        prev: el.getAttribute("content"),
        attr: "content",
      });
      el.setAttribute("content", PAGE_TITLE);
    }

    // og:description
    {
      const { el, created } = ensure('meta[property="og:description"]', () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:description");
        return m;
      });
      items.push({
        el,
        created,
        prev: el.getAttribute("content"),
        attr: "content",
      });
      el.setAttribute("content", PAGE_DESCRIPTION);
    }

    // og:url
    {
      const { el, created } = ensure('meta[property="og:url"]', () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:url");
        return m;
      });
      items.push({
        el,
        created,
        prev: el.getAttribute("content"),
        attr: "content",
      });
      el.setAttribute("content", CANONICAL_URL);
    }

    return () => {
      document.title = prevTitle;
      for (const it of items) {
        if (it.created) it.el.remove();
        else if (it.attr) {
          if (it.prev !== null && it.prev !== undefined)
            it.el.setAttribute(it.attr, it.prev);
        }
      }
    };
  }, []);
}

type GuideViewId =
  | "overview"
  | "blackout"
  | "where-you-can-fly"
  | "past-flights"
  | "faq";

interface NavItem {
  id: GuideViewId;
  label: string;
  icon: IconSvgElement;
}

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: Home01Icon },
  { id: "blackout", label: "Blackout Dates", icon: CalendarRemove02Icon },
  { id: "where-you-can-fly", label: "Where You Can Fly", icon: GlobeIcon },
  { id: "past-flights", label: "Past GoWild Flights", icon: Clock01Icon },
  { id: "faq", label: "FAQ", icon: BookOpen01Icon },
];

interface GuideSidebarProps {
  activeView: GuideViewId;
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
  onNavigate: (id: GuideViewId) => void;
}

function GuideSidebar({
  activeView,
  mobile = false,
  open = true,
  onClose,
  onNavigate,
}: GuideSidebarProps) {
  return (
    <aside
      id={mobile ? "gowild-guide-mobile-navigation" : undefined}
      aria-label="GoWild Guide navigation"
      aria-hidden={mobile && !open}
      className={[
        "flex flex-col bg-white",
        mobile
          ? "fixed inset-y-0 left-0 z-50 w-[80%] lg:w-72"
          : "hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:border-r lg:border-[#E5E7EB]",
      ].join(" ")}
      style={
        mobile
          ? {
              transform: open ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
              willChange: "transform",
              pointerEvents: open ? "auto" : "none",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3 px-6 pt-8 pb-3">
        <img
          src="/assets/logo/appicon.png"
          alt="Wildfly"
          className="h-12 w-12 rounded-2xl border-2 border-[#E3E6E6] bg-[#F0FDF4] object-cover shadow-sm shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[#9CA3AF] text-sm font-medium">Wildfly</p>
          <p className="text-[#2E4A4A] text-lg font-semibold truncate leading-tight">
            GoWild Guide
          </p>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide navigation"
            tabIndex={open ? 0 : -1}
            className="h-10 w-10 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={20}
              color="currentColor"
              strokeWidth={1.5}
            />
          </button>
        )}
      </div>

      <div className="h-px bg-[#E5E7EB] mx-6" />

      <nav className="flex-1 px-6 pt-3 flex flex-col gap-1 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#059669] px-2 pb-1">
          Guide
        </p>
        {NAV.map((item) => {
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-pressed={isActive}
              tabIndex={mobile && !open ? -1 : 0}
              className={[
                "flex items-center gap-2.5 py-1.5 rounded-xl px-2 transition-colors w-full text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2",
                isActive
                  ? "text-[#059669] hover:bg-[#F2F3F3]"
                  : "text-[#2E4A4A] hover:text-[#345C5A] hover:bg-[#F2F3F3]",
              ].join(" ")}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={20}
                color="currentColor"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span
                className={
                  isActive
                    ? "text-base font-extrabold"
                    : "text-base font-semibold"
                }
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
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
    <div className="flex items-start gap-4 rounded-2xl border border-[#F0F1F1] bg-white p-4 shadow-sm">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: "#F0FDF4" }}
      >
        <HugeiconsIcon icon={icon} size={24} color="#059669" strokeWidth={2} />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-extrabold text-[#1A2E2E] leading-snug">{title}</p>
        <p className="text-xs text-[#6B7B7B] leading-relaxed mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}

interface GuideViewMeta {
  title: string;
  description: string;
  headerPrefix: string;
  headerLabel: string;
  icon: IconSvgElement;
}

const VIEW_META: Record<GuideViewId, GuideViewMeta> = {
  overview: {
    title: "Overview",
    description:
      "The essential rules, costs, pass details, and booking guidance in one place.",
    headerPrefix: "GoWild",
    headerLabel: "Overview",
    icon: Home01Icon,
  },
  blackout: {
    title: "Blackout Dates",
    description:
      "Review the dates when standard GoWild redemption is normally restricted.",
    headerPrefix: "GoWild",
    headerLabel: "Blackout Dates",
    icon: CalendarRemove02Icon,
  },
  "where-you-can-fly": {
    title: "Where You Can Fly",
    description:
      "Choose an origin to explore Frontier destinations using the main app's route explorer.",
    headerPrefix: "Explore",
    headerLabel: "Routes",
    icon: GlobeIcon,
  },
  "past-flights": {
    title: "Past GoWild Flights",
    description:
      "Replay stored All Destinations results for a previous travel date without starting a live search.",
    headerPrefix: "Explore",
    headerLabel: "Past Flights",
    icon: Clock01Icon,
  },
  faq: {
    title: "FAQ",
    description:
      "Troubleshoot missing fares and search the most common GoWild questions.",
    headerPrefix: "GoWild",
    headerLabel: "FAQ",
    icon: BookOpen01Icon,
  },
};

function GuideViewHeader({ view }: { view: GuideViewId }) {
  const meta = VIEW_META[view];

  return (
    <div className="hidden lg:block lg:px-8 lg:pt-9 lg:pb-2">
      <div className="max-w-6xl mx-auto flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-white/80 border border-white/70 shadow-sm flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={meta.icon}
            size={23}
            color="#059669"
            strokeWidth={2}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#059669]">
            GoWild Guide
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A2E2E] leading-tight">
            {meta.title}
          </h1>
          <p className="text-sm text-[#6B7B7B] mt-1 max-w-2xl leading-relaxed">
            {meta.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function OverviewView({
  onNavigate,
}: {
  onNavigate: (view: GuideViewId) => void;
}) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <section className="relative w-full overflow-hidden">
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-10">
          <div className="flex flex-col items-center text-center">
            <img
              src="/assets/logo/logo_horizontal.png"
              alt="Wildfly"
              className="h-14 w-auto mb-3 sm:h-16"
              loading="eager"
            />
            <img
              src="/assets/logo/tag_noshadow.png"
              alt=""
              aria-hidden="true"
              className="h-6 w-auto mb-7 opacity-90 sm:h-7"
            />
            <p className="text-[#6B7B7B] text-sm sm:text-base leading-relaxed max-w-md">
              Everything you need to understand booking windows, fare prices,
              availability, blackout dates, and using your Frontier GoWild Pass.
            </p>
            <p className="text-[11px] text-[#6B7B7B] mt-5">
              Last verified with Frontier:{" "}
              <span className="font-semibold text-[#1A2E2E]">
                {new Date(`${LAST_VERIFIED_DATE}T00:00:00Z`).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </span>
            </p>
            <p className="text-[11px] text-[#6B7B7B] max-w-md mt-2 leading-relaxed">
              Wildfly is not affiliated with or endorsed by Frontier Airlines.
              Frontier's current terms, availability, and final checkout price
              control.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-8">
            <BenefitCard
              icon={Clock01Icon}
              title="Know When to Book"
              description="Origin-timezone guidance for the standard booking window."
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
      </section>

      <div className="max-w-2xl mx-auto w-full px-4 pb-16 space-y-4">
        <GuideSectionCard
          icon={Rocket01Icon}
          title="GoWild in 30 Seconds"
          subtitle="The most important rules at a glance."
        >
          <ul className="space-y-2">
            {QUICK_POINTS.map((point) => (
              <li
                key={point}
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
                <p className="text-sm text-[#2E4A4A] leading-snug">{point}</p>
              </li>
            ))}
          </ul>
        </GuideSectionCard>

        <GuideSectionCard
          icon={InformationCircleIcon}
          title="How to Inspect the Exact Fare"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                title: "Around $15",
                body: "Usually a domestic nonstop inside the normal booking window, mostly the $0.01 airfare plus required taxes and charges.",
              },
              {
                title: "Around $30+",
                body: "May indicate a connecting itinerary, multiple segments, territory routing, or another itinerary-specific charge.",
              },
              {
                title: "$59 / $79 / $119+",
                body: "May indicate a GoWild Early Booking charge, peak-date promotion, multiple segments, international taxes, or optional add-ons.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[#F0F1F1] bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-bold text-[#059669]">{card.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#6B7B7B]">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </GuideSectionCard>

        <GuideSectionCard icon={AirportIcon} title="Included vs. Extra">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E8EBEB] bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-1.5">
                Generally included
              </p>
              <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
                <li>
                  Personal item subject to Frontier's current restrictions
                </li>
                <li>
                  Confirmed reservation when GoWild inventory is available
                </li>
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

        <GuideSectionCard
          icon={Cancel01Icon}
          title="Changes, Cancellations & No-shows"
        >
          <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
            <li>Cancel before scheduled departure when you will not travel.</li>
            <li>Change and cancellation rules can vary.</li>
            <li>
              Optional products and early-booking charges may be non-refundable.
            </li>
            <li>Repeated no-shows can risk penalties or pass privileges.</li>
            <li>
              Check Frontier's current terms before changing a reservation.
            </li>
          </ul>
        </GuideSectionCard>

        <GuideSectionCard
          icon={AlertCircleIcon}
          title="Flight Cancellations & Disruptions"
        >
          <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
            <li>Check the reservation directly with Frontier.</li>
            <li>
              Review rebooking or refund options offered for that reservation.
            </li>
            <li>
              Contact Frontier support when automatic options are insufficient.
            </li>
            <li>
              Replacement GoWild availability may not appear through a normal
              search.
            </li>
            <li>Save confirmation details and receipts.</li>
            <li>
              Review Frontier's current Contract of Carriage and disruption
              policies.
            </li>
          </ul>
          <p className="text-xs text-[#6B7B7B] mt-2">
            Wildfly cannot promise hotels, meals, refunds, reimbursements, or
            rebooking outcomes.
          </p>
        </GuideSectionCard>

        <GuideSectionCard
          icon={UserMultipleIcon}
          title="Children & Multiple Travelers"
        >
          <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
            <li>
              Each traveler generally needs their own eligible GoWild Pass.
            </li>
            <li>Every passholder needs a separate Frontier Miles account.</li>
            <li>
              Children may hold a pass subject to current age and account
              requirements.
            </li>
            <li>
              Children below Frontier's independent-travel age must travel with
              an eligible adult.
            </li>
            <li>
              A child without a pass generally cannot use another passenger's
              GoWild benefit.
            </li>
            <li>
              Every traveler in a multi-passenger GoWild booking must have valid
              eligibility.
            </li>
            <li>
              A search may fail when the passenger count exceeds available
              GoWild inventory.
            </li>
          </ul>
        </GuideSectionCard>

        <GuideSectionCard icon={Calendar01Icon} title="Pass Types & Renewal">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["Annual Pass", "Summer Pass", "Monthly Pass"].map((name) => (
              <div
                key={name}
                className="rounded-xl border border-[#E8EBEB] bg-white p-3"
              >
                <p className="text-sm font-bold text-[#1A2E2E]">{name}</p>
                <p className="text-xs text-[#6B7B7B] mt-1">
                  Eligible travel period, renewal price, and renewal behavior
                  are set by Frontier and may change. Manage automatic renewal
                  inside the Frontier Miles account.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#E8EBEB] bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#059669] mb-1.5">
              Known travel periods
            </p>
            <ul className="text-sm text-[#2E4A4A] space-y-1">
              {PASS_TRAVEL_PERIODS.map((period) => (
                <li key={period.name}>
                  <span className="font-semibold">{period.name}:</span>{" "}
                  {period.travelStart} → {period.travelEnd}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[#9CA3AF] mt-2">
              All dates and prices are subject to change.
            </p>
          </div>
          <a
            href="https://booking.flyfrontier.com/FrontierMiles/GoWildSignup"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#10B981] bg-[#F0FDF4] px-4 py-2.5 text-sm font-bold text-[#059669] transition-colors hover:bg-[#DCFCE7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
          >
            <HugeiconsIcon
              icon={GiftIcon}
              size={17}
              color="currentColor"
              strokeWidth={2}
            />
            <span>Buy your Frontier GoWild Pass</span>
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={16}
              color="currentColor"
              strokeWidth={2}
            />
          </a>
        </GuideSectionCard>

        <GuideSectionCard
          icon={BookOpen01Icon}
          title="Step-by-Step Booking Guide"
        >
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
      </div>
    </div>
  );
}

function BlackoutDatesView() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-5 pb-16 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <GuideSectionCard
        icon={CalendarRemove02Icon}
        title="Blackout Dates"
        subtitle="Months where standard GoWild redemption is normally restricted."
      >
        <BlackoutCalendar />
      </GuideSectionCard>
    </div>
  );
}

function WhereYouCanFlyView({
  onAppNavigate,
}: {
  onAppNavigate: (page: string, data?: string) => void;
}) {
  return (
    <div className="pb-16 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="max-w-6xl mx-auto">
        <RoutesPage
          onNavigate={onAppNavigate}
          restoreInitialOrigin={false}
        />
      </div>
    </div>
  );
}

function FaqView() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-5 pb-16 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <GuideSectionCard
        icon={BookOpen01Icon}
        title="Frequently Asked Questions"
        subtitle="Search to find an answer."
      >
        <GoWildFaq />
      </GuideSectionCard>

      <GuideSectionCard icon={ArrowUpRight01Icon} title="Official Resources">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RESOURCE_LINKS.map((resource) => (
            <a
              key={resource.url}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[#E8EBEB] bg-white px-3 py-3 text-sm font-semibold text-[#1A2E2E] hover:border-[#10B981] hover:text-[#059669] flex items-center justify-between gap-2 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            >
              <span>{resource.label}</span>
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={16}
                color="currentColor"
                strokeWidth={2}
              />
            </a>
          ))}
        </div>
        <p className="text-[11px] text-[#6B7B7B] mt-3">
          External links open in a new tab. Frontier's current terms always
          control.
        </p>
      </GuideSectionCard>
    </div>
  );
}

export default function GoWildGuidePage() {
  usePageMetadata();

  const [activeView, setActiveView] = useState<GuideViewId>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pastFlightsShowingResults, setPastFlightsShowingResults] = useState(false);
  const activeMeta = VIEW_META[activeView];
  const hideGuideChrome = activeView === "past-flights" && pastFlightsShowingResults;

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const handleNavigate = useCallback((view: GuideViewId) => {
    setActiveView(view);
    setPastFlightsShowingResults(false);
    setDrawerOpen(false);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "auto" }),
    );
  }, []);

  const handleAppNavigate = useCallback((page: string) => {
    sessionStorage.setItem("wf_returnPage", page);
    window.location.assign("/");
  }, []);

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={{
        background:
          "linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 28%, #BBF7D0 62%, #A7F3D0 100%)",
      }}
    >
      <div className="min-h-screen lg:flex">
        <GuideSidebar
          activeView={activeView}
          mobile
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onNavigate={handleNavigate}
        />

        <button
          type="button"
          aria-label="Close guide navigation"
          aria-hidden={!drawerOpen}
          tabIndex={drawerOpen ? 0 : -1}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          style={{
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity 0.32s cubic-bezier(0.4,0,0.2,1)",
          }}
        />

        <div
          className={[
            "min-w-0 flex-1 transition-all duration-300 ease-in-out",
            drawerOpen
              ? "translate-x-[44%] rounded-[20px] shadow-[0_8px_40px_0_rgba(0,0,0,0.22),0_2px_8px_0_rgba(0,0,0,0.10)] overflow-hidden"
              : "translate-x-0 rounded-none shadow-none",
          ].join(" ")}
        >
          {!hideGuideChrome && (
            <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#F0FDF4]/90 px-5 py-3 backdrop-blur-md border-b border-[#BBF7D0]/70 lg:min-h-[146px] lg:items-center lg:px-14 lg:py-8">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open guide navigation"
                aria-controls="gowild-guide-mobile-navigation"
                aria-expanded={drawerOpen}
                className="h-11 w-10 flex shrink-0 items-center justify-start rounded-lg text-[#2E4A4A] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] lg:h-12 lg:w-12 lg:items-start lg:pt-1"
              >
                <HugeiconsIcon
                  icon={Menu03Icon}
                  size={26}
                  color="currentColor"
                  strokeWidth={2}
                />
              </button>
              <div className="min-w-0 select-none">
                <div className="flex items-baseline gap-1.5 lg:hidden">
                  <span className="text-[18px] font-medium text-[#6B7280] shrink-0">
                    {activeMeta.headerPrefix}
                  </span>
                  <span className="text-[18px] font-black tracking-wider uppercase text-[#10B981] truncate">
                    {activeMeta.headerLabel}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#059669]">
                    GoWild Guide
                  </p>
                  <h1 className="mt-1 text-[40px] font-black leading-none tracking-tight text-[#1A2E2E]">
                    {activeMeta.title}
                  </h1>
                  <p className="mt-4 max-w-3xl text-[19px] leading-relaxed text-[#6B7B7B]">
                    {activeMeta.description}
                  </p>
                </div>
              </div>
            </header>
          )}

          <section
            id="gowild-guide-view"
            aria-label={`${activeMeta.title} view`}
            key={activeView}
          >
            {activeView === "overview" && <OverviewView onNavigate={handleNavigate} />}
            {activeView === "blackout" && <BlackoutDatesView />}
            {activeView === "where-you-can-fly" && (
              <WhereYouCanFlyView onAppNavigate={handleAppNavigate} />
            )}
            {activeView === "past-flights" && <PastGoWildFlights onResultsModeChange={setPastFlightsShowingResults} />}
            {activeView === "faq" && <FaqView />}
          </section>
        </div>
      </div>
    </main>
  );
}
