import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Camera } from "lucide-react";

const HomePage = ({ onSignOut }: { onSignOut: () => void }) => {
  const navigate = useNavigate();
  const { user } = useUserProfile();
  const avatarUrl = user?.image_file?.startsWith("http") ? user.image_file : null;

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-accent-pink/30 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-accent-blue/30 animate-float-delay" />

      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Hearme</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign Out
          </button>
          <button
            onClick={() => navigate("/user-hub")}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
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
