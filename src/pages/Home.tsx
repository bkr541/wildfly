const HomePage = ({ onSignOut }: { onSignOut: () => void }) => {
  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-accent-pink/30 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-accent-blue/30 animate-float-delay" />

      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Hearme</p>
        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-3xl font-bold text-foreground mb-3">Hello there! 👋</h1>
        <p className="text-muted-foreground text-center max-w-xs">
          You're signed in. Start exploring and building your experience.
        </p>
      </div>
    </div>
  );
};

export default HomePage;
