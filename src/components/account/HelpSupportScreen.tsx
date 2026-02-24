import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faBook, faComments, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface HelpSupportScreenProps {
  onBack: () => void;
}

const items: { icon: IconDefinition; label: string; desc: string }[] = [
  { icon: faBook, label: "FAQs", desc: "Browse frequently asked questions" },
  { icon: faComments, label: "Contact Support", desc: "Chat with our support team" },
  { icon: faEnvelope, label: "Email Us", desc: "support@wildfly.app" },
];

const HelpSupportScreen = ({ onBack }: HelpSupportScreenProps) => (
  <div className="flex flex-col h-full animate-fade-in">

    <div className="flex-1 px-5 pb-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
        {items.map((item, idx) => (
          <button
            key={item.label}
            type="button"
            className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors ${idx < items.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}
          >
            <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center mr-3 shrink-0">
              <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5 text-[#345C5A]" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2E4A4A]">{item.label}</p>
              <p className="text-xs text-[#6B7B7B]">{item.desc}</p>
            </div>
            <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-[#C4CACA]" />
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-[#849494] mt-6">WildFly v1.0.0</p>
    </div>
  </div>
);

export default HelpSupportScreen;
