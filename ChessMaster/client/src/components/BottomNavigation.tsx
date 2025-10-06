import { useLocation } from "wouter";
import { 
  Home as HomeIcon, 
  Trophy, 
  Play, 
  BarChart3, 
  GraduationCap 
} from "lucide-react";

const navigationItems = [
  { path: "/", icon: HomeIcon, label: "Home" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { path: "/play", icon: Play, label: "Play" },
  { path: "/stats", icon: BarChart3, label: "Stats" },
  { path: "/tutorial", icon: GraduationCap, label: "Tutorial" },
];

export default function BottomNavigation() {
  const [location, setLocation] = useLocation();

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-slate-800 border-t border-slate-700">
      <div className="flex justify-around py-2">
        {navigationItems.map(({ path, icon: Icon, label }) => {
          const isActive = location === path;
          
          return (
            <button
              key={path}
              onClick={() => setLocation(path)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? "text-blue-400 bg-blue-900/30" 
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <Icon className="text-lg mb-1" size={20} />
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
