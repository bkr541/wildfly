import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, UserPen, MapPin, Heart } from "lucide-react";

const items = [
  { label: "Edit Profile", icon: UserPen, path: "/user-hub/account/edit-profile" },
  { label: "Home City", icon: MapPin, path: "/user-hub/account/home-city" },
  { label: "Favorite Destinations", icon: Heart, path: "/user-hub/account/favorite-destinations" },
];

const Account = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex items-center px-6 pt-10 pb-2">
        <button onClick={() => navigate("/user-hub")} className="mr-3 text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Account</h1>
      </div>
      <div className="px-6 pb-4">
        <p className="text-muted-foreground text-sm">Manage your profile and destinations.</p>
      </div>

      <div className="px-6 space-y-1">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-foreground text-sm font-medium">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default Account;
