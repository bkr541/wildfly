import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  UserIcon,
  Mail01Icon,
  AirportIcon,
  Cancel01Icon,
  Rocket01Icon,
  AirplaneTakeOff01Icon,
  AirplaneSeatIcon,
  SearchingIcon,
  Location01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { AirportSearchSheet, type Airport } from "@/components/AirportSearchSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  GOWILD_STATUS_OPTIONS,
  GOWILD_PASS_DURATION_OPTIONS,
  GOWILD_SEARCH_FREQUENCY_OPTIONS,
  FRONTIER_FLIGHT_FREQUENCY_OPTIONS,
  USES_GOWILD_SEARCH_TOOL_OPTIONS,
  BETA_TESTING_EXPERIENCE_OPTIONS,
  PRIMARY_DEVICE_OPTIONS,
  PREFERRED_FEEDBACK_METHOD_OPTIONS,
  INTERESTED_FEATURES_OPTIONS,
  type BetaSignupOption,
} from "@/constants/betaSignup";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "homeAirport"
    | "gowildStatus"
    | "gowildPassDuration"
    | "gowildSearchFrequency"
    | "frontierFlightFrequency"
    | "usesGowildSearchTool"
    | "gowildSearchToolName"
    | "betaTestingExperience"
    | "betaTestingDetails"
    | "feedbackCommitment"
    | "primaryDevice",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionPills({
  options,
  value,
  onChange,
  allowDeselect = false,
}: {
  options: BetaSignupOption[];
  value: string;
  onChange: (v: string) => void;
  allowDeselect?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() =>
              allowDeselect && selected ? onChange("") : onChange(opt.value)
            }
            className={[
              "w-full text-left px-4 py-3.5 min-h-[48px] rounded-xl text-sm border transition-all leading-snug flex items-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1",
              selected
                ? "bg-[#F0FDF4] border-[#059669] text-[#059669] font-semibold"
                : "bg-white border-[#E5E7EB] text-[#374151] font-medium hover:border-[#6EE7B7] hover:bg-[#FAFAFA]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiOptionPills({
  options,
  values,
  onChange,
}: {
  options: BetaSignupOption[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) =>
    onChange(
      values.includes(val) ? values.filter((x) => x !== val) : [...values, val]
    );
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(opt.value)}
            className={[
              "px-4 py-2.5 min-h-[40px] rounded-full text-sm font-semibold border transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1",
              selected
                ? "bg-[#059669] border-[#059669] text-white"
                : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#6EE7B7] hover:bg-[#FAFAFA]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FormQuestion({
  label,
  htmlFor,
  required,
  error,
  fieldId,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  fieldId?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={fieldId} role={htmlFor ? undefined : "group"} aria-label={htmlFor ? undefined : label}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold text-[#2E4A4A] block mb-2.5 leading-snug"
      >
        {label}
        {required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-red-400 text-xs mt-2 font-semibold flex items-center gap-1">
          <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: IconSvgElement; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
        <HugeiconsIcon icon={icon} size={14} color="#059669" strokeWidth={2} />
      </div>
      <h3 className="text-xs font-bold text-[#059669] uppercase tracking-widest">
        {title}
      </h3>
    </div>
  );
}

function textareaCls(error?: string): string {
  return [
    "w-full px-4 py-3 rounded-xl border bg-white text-sm text-[#374151]",
    "placeholder-[#9CA3AF] focus:outline-none resize-none transition-all",
    "focus:ring-2",
    error
      ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
      : "border-[#E5E7EB] focus:border-[#059669] focus:ring-[#059669]/10",
  ].join(" ");
}

// ── BetaSignup ────────────────────────────────────────────────────────────────

export default function BetaSignup() {
  // Required fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [gowildStatus, setGowildStatus] = useState("");
  const [gowildPassDuration, setGowildPassDuration] = useState("");
  const [gowildSearchFrequency, setGowildSearchFrequency] = useState("");
  const [frontierFlightFrequency, setFrontierFlightFrequency] = useState("");
  const [usesGowildSearchTool, setUsesGowildSearchTool] = useState("");
  const [gowildSearchToolName, setGowildSearchToolName] = useState("");
  const [betaTestingExperience, setBetaTestingExperience] = useState("");
  const [betaTestingDetails, setBetaTestingDetails] = useState("");
  const [feedbackCommitment, setFeedbackCommitment] = useState(false);
  const [primaryDevice, setPrimaryDevice] = useState("");

  // Optional fields
  const [frequentDestinations, setFrequentDestinations] = useState("");
  const [interestedFeatures, setInterestedFeatures] = useState<string[]>([]);
  const [valueExpectation, setValueExpectation] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [preferredFeedbackMethod, setPreferredFeedbackMethod] = useState("");

  // Honeypot — filled only by bots
  const [website, setWebsite] = useState("");

  // Airport search
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [airportSheetOpen, setAirportSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, location_id, locations(city, state_code, region)")
        .eq("is_active", true)
        .order("name");
      if (data) setAirports(data as unknown as Airport[]);
    })();
  }, []);

  // Submission state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Conditional visibility
  const showPassDuration =
    gowildStatus === "current_pass_holder" || gowildStatus === "former_pass_holder";
  const showToolName =
    usesGowildSearchTool === "yes" || usesGowildSearchTool === "used_to";
  const showBetaDetails =
    betaTestingExperience === "yes_professional" || betaTestingExperience === "informal";

  function clearError(...keys: (keyof FormErrors)[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  // Validates all required fields in visual top-to-bottom order so that
  // Object.keys(errs)[0] always points to the first visible invalid field.
  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!fullName.trim())
      errs.fullName = "Full name is required.";

    const emailTrimmed = email.trim();
    if (!emailTrimmed)
      errs.email = "Email address is required.";
    else if (!EMAIL_RE.test(emailTrimmed))
      errs.email = "Please enter a valid email address.";

    if (!homeAirport.trim())
      errs.homeAirport = "Home airport is required.";

    if (!gowildStatus)
      errs.gowildStatus = "Please select an option.";

    if (showPassDuration && !gowildPassDuration)
      errs.gowildPassDuration = "Please select how long you've had the GoWild Pass.";

    if (!gowildSearchFrequency)
      errs.gowildSearchFrequency = "Please select an option.";

    if (!frontierFlightFrequency)
      errs.frontierFlightFrequency = "Please select an option.";

    if (!usesGowildSearchTool)
      errs.usesGowildSearchTool = "Please select an option.";

    if (showToolName && !gowildSearchToolName.trim())
      errs.gowildSearchToolName = "Please name the tool you use.";

    if (!betaTestingExperience)
      errs.betaTestingExperience = "Please select an option.";

    if (showBetaDetails && !betaTestingDetails.trim())
      errs.betaTestingDetails = "Please describe your beta testing experience.";

    if (!feedbackCommitment)
      errs.feedbackCommitment = "You must agree to provide feedback to apply.";

    if (!primaryDevice)
      errs.primaryDevice = "Please select your primary device.";

    return errs;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0] as keyof FormErrors;
      requestAnimationFrame(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }

    // Honeypot check — bots fill hidden fields, real users don't
    if (website.trim() !== "") {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);

    // Capture UTM params and referrer at submit time
    const params = new URLSearchParams(window.location.search);

    // TODO: Remove cast after running `supabase gen types typescript` to include beta_applications.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("beta_applications") as any).insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      home_airport: homeAirport.trim(),
      gowild_status: gowildStatus,
      gowild_pass_duration: showPassDuration ? gowildPassDuration || null : null,
      gowild_search_frequency: gowildSearchFrequency,
      frontier_flight_frequency: frontierFlightFrequency,
      uses_gowild_search_tool: usesGowildSearchTool,
      gowild_search_tool_name: showToolName ? gowildSearchToolName.trim() || null : null,
      beta_testing_experience: betaTestingExperience,
      beta_testing_details: showBetaDetails ? betaTestingDetails.trim() || null : null,
      feedback_commitment: feedbackCommitment,
      primary_device: primaryDevice,
      preferred_feedback_method: preferredFeedbackMethod || null,
      frequent_destinations: frequentDestinations.trim() || null,
      interested_features: interestedFeatures,
      value_expectation: valueExpectation.trim() || null,
      additional_notes: additionalNotes.trim() || null,
      source: params.get("source") || "public_beta_page",
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null,
      referrer: document.referrer || null,
    });

    setSubmitting(false);

    if (error) {
      // PostgreSQL unique violation on normalized_email — already applied
      if (error.code === "23505") {
        setIsDuplicate(true);
        setSubmitted(true);
        return;
      }
      toast.error(
        "Something went wrong submitting your application. Please try again."
      );
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F9F9] pb-20 overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 pt-8 sm:pt-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          <img
            src="/assets/logo/wflogo2.png"
            alt="Wildfly"
            className="h-12 sm:h-14 w-auto object-contain mb-5"
          />

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F0FDF4] text-[#059669] border border-[#6EE7B7] mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669] animate-pulse" />
            Limited beta tester spots available
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-[#1A2E2E] mb-3 leading-tight">
            Help Shape the Future of Wildfly
          </h1>
          <p className="text-base text-[#6B7B7B] max-w-lg leading-relaxed">
            Apply to become a Wildfly beta tester and help improve the way GoWild travelers
            find availability, track flights, and discover better travel opportunities.
          </p>
        </div>

        {/* ── Benefits ─────────────────────────────────────────────────────── */}
        {/* Horizontal scroll on mobile, 3-col grid on sm+ */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-8 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:gap-4 sm:mb-10 snap-x snap-mandatory sm:snap-none">
          {([
            {
              icon: Rocket01Icon,
              title: "Early Access",
              desc: "Try new Wildfly features before public release.",
            },
            {
              icon: AirplaneSeatIcon,
              title: "Direct Feedback",
              desc: "Help identify bugs, confusing flows, and missing features.",
            },
            {
              icon: AirportIcon,
              title: "Better GoWild Tools",
              desc: "Shape tools built specifically around real GoWild travel behavior.",
            },
          ] as { icon: IconSvgElement; title: string; desc: string }[]).map(
            ({ icon, title, desc }) => (
              <div
                key={title}
                className="flex-none w-[200px] snap-start sm:w-auto bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#F0F1F1]"
              >
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center mb-3">
                  <HugeiconsIcon icon={icon} size={18} color="#059669" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-[#2E4A4A] mb-1">{title}</h3>
                <p className="text-xs text-[#6B7B7B] leading-relaxed">{desc}</p>
              </div>
            )
          )}
        </div>

        {/* ── Success state ─────────────────────────────────────────────────── */}
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F1] overflow-hidden mb-10">
            {/* Green accent bar at top */}
            <div
              className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #10B981 0%, #059669 100%)" }}
            />
            <div className="px-6 py-10 sm:py-14 flex flex-col items-center text-center">
              {/* Icon ring */}
              <div className="relative mb-7">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #D1FAE5 100%)" }}
                >
                  <svg
                    aria-hidden="true"
                    className="h-9 w-9 text-[#059669]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {/* Outer pulse ring */}
                <div
                  className="absolute inset-0 rounded-full opacity-30 animate-ping"
                  style={{ background: "radial-gradient(circle, #6EE7B7 0%, transparent 70%)" }}
                />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[#1A2E2E] mb-3 leading-tight">
                {isDuplicate ? "Looks like you already applied." : "You're on the list"}
              </h2>

              {isDuplicate && (
                <p className="text-base font-semibold text-[#059669] mb-2">
                  You're on the list.
                </p>
              )}

              <p className="text-sm text-[#6B7B7B] max-w-sm leading-relaxed mb-8">
                Thanks for applying to become a Wildfly beta tester. I'll review applications
                and reach out if you're selected for early access.
              </p>

              <Link
                to="/preview"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold shadow hover:shadow-md active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 mb-6"
              >
                <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={16} color="white" strokeWidth={2} />
                Explore Wildfly
              </Link>

              <p className="text-xs text-[#B0BEC5] leading-relaxed max-w-xs">
                Submitting an application does not guarantee beta access.
              </p>
            </div>
          </div>
        ) : (

        /* ── Application form ──────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F1] overflow-hidden mb-10">

          <div
            className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#F0F1F1]"
            style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)" }}
          >
            <h2 className="text-lg font-black text-[#1A2E2E]">Beta Tester Application</h2>
            <p className="text-sm text-[#6B7B7B] mt-0.5">
              Fields marked <span className="text-red-400" aria-hidden="true">*</span>
              <span className="sr-only">with an asterisk</span> are required.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Honeypot: hidden from real users via CSS, reachable by bots */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
                height: 0,
                width: 0,
                overflow: "hidden",
              }}
            >
              <label htmlFor="hp-website">Website</label>
              <input
                id="hp-website"
                name="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="px-4 py-5 sm:px-6 sm:py-6 flex flex-col gap-6">

              {/* ── About You ──────────────────────────────────────────────── */}
              <SectionHeader icon={UserIcon} title="About You" />

              <div id="field-fullName">
                <AppInput
                  icon={UserIcon}
                  label="Full Name *"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
                  autoComplete="name"
                  maxLength={120}
                  error={errors.fullName}
                />
              </div>

              <div id="field-email">
                <AppInput
                  icon={Mail01Icon}
                  label="Email Address *"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                  autoComplete="email"
                  maxLength={254}
                  error={errors.email}
                />
              </div>

              <div id="field-homeAirport">
                <AirportSearchSheet
                  open={airportSheetOpen}
                  onClose={() => setAirportSheetOpen(false)}
                  airports={airports}
                  onSelect={(a) => {
                    setSelectedAirport(a);
                    setHomeAirport(a.iata_code);
                    clearError("homeAirport");
                  }}
                />
                <label className="text-sm font-semibold text-[#2E4A4A] ml-1 block mb-2.5">
                  Home Airport{" "}
                  <span className="text-red-400" aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <div
                  className={[
                    "app-input-container cursor-pointer",
                    errors.homeAirport ? "app-input-error" : "",
                  ].join(" ")}
                  onClick={() => setAirportSheetOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setAirportSheetOpen(true);
                  }}
                  aria-label="Select home airport"
                  aria-invalid={errors.homeAirport ? "true" : undefined}
                  aria-describedby={errors.homeAirport ? "err-homeAirport" : undefined}
                >
                  <button type="button" tabIndex={-1} className="app-input-icon-btn">
                    <HugeiconsIcon icon={AirportIcon} size={20} color="currentColor" strokeWidth={2} />
                  </button>
                  <span
                    className="app-input truncate flex-1 flex items-center"
                    style={{ color: selectedAirport ? "#1F2937" : "#9CA3AF" }}
                  >
                    {selectedAirport
                      ? `${selectedAirport.iata_code} – ${selectedAirport.name}`
                      : "Search airport or city…"}
                  </span>
                  {selectedAirport && (
                    <button
                      type="button"
                      className="app-input-reset app-input-reset--visible"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAirport(null);
                        setHomeAirport("");
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                    </button>
                  )}
                </div>
                {errors.homeAirport && (
                  <p
                    id="err-homeAirport"
                    role="alert"
                    className="text-red-400 text-xs mt-2 ml-1 font-semibold flex items-center gap-1"
                  >
                    <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {errors.homeAirport}
                  </p>
                )}
              </div>

              <div className="border-t border-[#F0F1F1]" />

              {/* ── GoWild Pass ────────────────────────────────────────────── */}
              <SectionHeader icon={AirplaneTakeOff01Icon} title="GoWild Pass" />

              <FormQuestion
                label="Are you currently a Frontier GoWild Pass holder?"
                required
                error={errors.gowildStatus}
                fieldId="field-gowildStatus"
              >
                <OptionPills
                  options={GOWILD_STATUS_OPTIONS}
                  value={gowildStatus}
                  onChange={(v) => {
                    setGowildStatus(v);
                    setGowildPassDuration("");
                    clearError("gowildStatus", "gowildPassDuration");
                  }}
                />
              </FormQuestion>

              {showPassDuration && (
                <FormQuestion
                  label="How long have you had or did you have the GoWild Pass?"
                  required
                  error={errors.gowildPassDuration}
                  fieldId="field-gowildPassDuration"
                >
                  <OptionPills
                    options={GOWILD_PASS_DURATION_OPTIONS}
                    value={gowildPassDuration}
                    onChange={(v) => {
                      setGowildPassDuration(v);
                      clearError("gowildPassDuration");
                    }}
                  />
                </FormQuestion>
              )}

              <div className="border-t border-[#F0F1F1]" />

              {/* ── Travel Behavior ────────────────────────────────────────── */}
              <SectionHeader icon={SearchingIcon} title="Travel Behavior" />

              <FormQuestion
                label="How often do you search for GoWild flights?"
                required
                error={errors.gowildSearchFrequency}
                fieldId="field-gowildSearchFrequency"
              >
                <OptionPills
                  options={GOWILD_SEARCH_FREQUENCY_OPTIONS}
                  value={gowildSearchFrequency}
                  onChange={(v) => {
                    setGowildSearchFrequency(v);
                    clearError("gowildSearchFrequency");
                  }}
                />
              </FormQuestion>

              <FormQuestion
                label="How often do you fly Frontier?"
                required
                error={errors.frontierFlightFrequency}
                fieldId="field-frontierFlightFrequency"
              >
                <OptionPills
                  options={FRONTIER_FLIGHT_FREQUENCY_OPTIONS}
                  value={frontierFlightFrequency}
                  onChange={(v) => {
                    setFrontierFlightFrequency(v);
                    clearError("frontierFlightFrequency");
                  }}
                />
              </FormQuestion>

              <div className="border-t border-[#F0F1F1]" />

              {/* ── Current Tools ──────────────────────────────────────────── */}
              <SectionHeader icon={AirportIcon} title="Current Tools" />

              <FormQuestion
                label="Do you currently use any Frontier GoWild search app, tool, spreadsheet, alert system, or website?"
                required
                error={errors.usesGowildSearchTool}
                fieldId="field-usesGowildSearchTool"
              >
                <OptionPills
                  options={USES_GOWILD_SEARCH_TOOL_OPTIONS}
                  value={usesGowildSearchTool}
                  onChange={(v) => {
                    setUsesGowildSearchTool(v);
                    setGowildSearchToolName("");
                    clearError("usesGowildSearchTool", "gowildSearchToolName");
                  }}
                />
              </FormQuestion>

              {showToolName && (
                <div id="field-gowildSearchToolName">
                  <AppInput
                    icon={SearchingIcon}
                    label="Which app, tool, website, spreadsheet, or system do you use? *"
                    placeholder="e.g. GoWild Tracker, a spreadsheet, Reddit alerts…"
                    value={gowildSearchToolName}
                    onChange={(e) => {
                      setGowildSearchToolName(e.target.value);
                      clearError("gowildSearchToolName");
                    }}
                    maxLength={255}
                    error={errors.gowildSearchToolName}
                  />
                </div>
              )}

              <div className="border-t border-[#F0F1F1]" />

              {/* ── Beta Testing Experience ────────────────────────────────── */}
              <SectionHeader icon={UserAdd01Icon} title="Beta Testing Experience" />

              <FormQuestion
                label="Have you ever professionally contributed to a beta testing program?"
                required
                error={errors.betaTestingExperience}
                fieldId="field-betaTestingExperience"
              >
                <OptionPills
                  options={BETA_TESTING_EXPERIENCE_OPTIONS}
                  value={betaTestingExperience}
                  onChange={(v) => {
                    setBetaTestingExperience(v);
                    setBetaTestingDetails("");
                    clearError("betaTestingExperience", "betaTestingDetails");
                  }}
                />
              </FormQuestion>

              {showBetaDetails && (
                <div id="field-betaTestingDetails">
                  <label
                    htmlFor="betaTestingDetails"
                    className="text-sm font-semibold text-[#2E4A4A] block mb-2 leading-snug"
                  >
                    What company, product, app, or business sector did you beta test for?
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <textarea
                    id="betaTestingDetails"
                    value={betaTestingDetails}
                    onChange={(e) => {
                      setBetaTestingDetails(e.target.value);
                      clearError("betaTestingDetails");
                    }}
                    placeholder="Tell us about your experience…"
                    rows={3}
                    maxLength={500}
                    className={textareaCls(errors.betaTestingDetails)}
                  />
                  {errors.betaTestingDetails && (
                    <p role="alert" className="text-red-400 text-xs mt-2 font-semibold flex items-center gap-1">
                      <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      {errors.betaTestingDetails}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-[#F0F1F1]" />

              {/* ── Availability & Device ──────────────────────────────────── */}
              <SectionHeader icon={AirplaneSeatIcon} title="Availability & Device" />

              <div id="field-feedbackCommitment">
                <p className="text-sm font-semibold text-[#2E4A4A] mb-3 leading-snug">
                  Are you willing to provide honest feedback, report bugs, and answer
                  occasional follow-up questions?
                  <span className="text-red-400 ml-0.5">*</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackCommitment((v) => !v);
                    clearError("feedbackCommitment");
                  }}
                  role="checkbox"
                  aria-checked={feedbackCommitment}
                  className="flex items-start gap-3 text-left w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 rounded-lg"
                >
                  <div
                    className={[
                      "mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      feedbackCommitment
                        ? "bg-[#059669] border-[#059669]"
                        : errors.feedbackCommitment
                        ? "bg-white border-red-400"
                        : "bg-white border-[#D1D5DB] group-hover:border-[#6EE7B7]",
                    ].join(" ")}
                  >
                    {feedbackCommitment && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-[#374151] leading-snug pt-0.5">
                    I'm willing to provide honest feedback, report bugs, and answer occasional
                    follow-up questions.
                  </span>
                </button>
                {errors.feedbackCommitment && (
                  <p role="alert" className="text-red-400 text-xs mt-2 font-semibold ml-8 flex items-center gap-1">
                    <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {errors.feedbackCommitment}
                  </p>
                )}
              </div>

              <FormQuestion
                label="What device would you primarily use Wildfly on?"
                required
                error={errors.primaryDevice}
                fieldId="field-primaryDevice"
              >
                <OptionPills
                  options={PRIMARY_DEVICE_OPTIONS}
                  value={primaryDevice}
                  onChange={(v) => {
                    setPrimaryDevice(v);
                    clearError("primaryDevice");
                  }}
                />
              </FormQuestion>

              <div className="border-t border-[#F0F1F1]" />

              {/* ── Optional ───────────────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">
                  Optional
                </h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  These fields help us understand your needs better but are not required.
                </p>
              </div>

              <AppInput
                icon={Location01Icon}
                label="Which destinations do you search most often?"
                placeholder="e.g. Cancún, Las Vegas, New York…"
                value={frequentDestinations}
                onChange={(e) => setFrequentDestinations(e.target.value)}
                maxLength={500}
              />

              <div>
                <p className="text-sm font-semibold text-[#2E4A4A] mb-3 leading-snug">
                  Which Wildfly features are you most excited to test?
                </p>
                <MultiOptionPills
                  options={INTERESTED_FEATURES_OPTIONS}
                  values={interestedFeatures}
                  onChange={setInterestedFeatures}
                />
              </div>

              <div>
                <label
                  htmlFor="valueExpectation"
                  className="text-sm font-semibold text-[#2E4A4A] block mb-2 leading-snug"
                >
                  What would make Wildfly valuable enough for you to keep using?
                </label>
                <textarea
                  id="valueExpectation"
                  value={valueExpectation}
                  onChange={(e) => setValueExpectation(e.target.value)}
                  placeholder="What problem would Wildfly need to solve for you?"
                  rows={3}
                  maxLength={1000}
                  className={textareaCls()}
                />
              </div>

              <FormQuestion
                label="How would you prefer to give feedback?"
                htmlFor="preferredFeedbackMethod"
              >
                <OptionPills
                  options={PREFERRED_FEEDBACK_METHOD_OPTIONS}
                  value={preferredFeedbackMethod}
                  onChange={setPreferredFeedbackMethod}
                  allowDeselect
                />
              </FormQuestion>

              <div>
                <label
                  htmlFor="additionalNotes"
                  className="text-sm font-semibold text-[#2E4A4A] block mb-2 leading-snug"
                >
                  Anything else you want me to know?
                </label>
                <textarea
                  id="additionalNotes"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any other context, questions, or notes…"
                  rows={3}
                  maxLength={1000}
                  className={textareaCls()}
                />
              </div>

              {/* ── Submit ─────────────────────────────────────────────────── */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-13 py-3.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        aria-hidden="true"
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting…
                    </span>
                  ) : (
                    "Submit Application"
                  )}
                </button>
                <p className="text-center text-xs text-[#9CA3AF] mt-4 leading-relaxed">
                  We'll review all applications and reach out via email.
                  Not everyone will be selected for the initial beta.
                </p>
              </div>

            </div>
          </form>
        </div>

        )} {/* end submitted ternary */}

      </div>
    </div>
  );
}
