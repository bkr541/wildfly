const BetaFeedbackButton = () => (
  <button
    type="button"
    aria-label="Submit beta feedback"
    className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform duration-150 active:scale-95 hover:scale-105"
    style={{ background: "#10B981" }}
  >
    <img src="/assets/icons/feedback.svg" alt="" className="w-6 h-6" />
  </button>
);

export default BetaFeedbackButton;
