import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Crown, 
  Trophy, 
  Handshake, 
  X, 
  Bell,
  Users,
  Target,
  Zap,
  Gift
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import AnimatedCounter from "@/components/AnimatedCounter";
import NotificationBanner from "@/components/NotificationBanner";

export default function Home() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: recentGames = [] } = useQuery({
    queryKey: ["/api/games/user/recent"],
    retry: false,
  });

  const { data: userRankData } = useQuery({
    queryKey: ["/api/leaderboard/rank"],
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const xpProgress = ((user.xp % 1000) / 1000) * 100;
  const nextLevelXp = (Math.floor(user.xp / 1000) + 1) * 1000;

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText("CHESS2024");
    toast({
      title: "Copied!",
      description: "Referral code copied to clipboard",
    });
  };

  return (
    <div className="pb-20">
      {/* Achievement Notification */}
      {user.currentStreak >= 3 && (
        <div className="px-4 pt-4">
          <NotificationBanner
            type="achievement"
            title="Hot Streak!"
            message={`You're on a ${user.currentStreak} game winning streak! Keep it up!`}
            autoHide={false}
          />
        </div>
      )}

      {/* Top Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center animate-pulse">
              <Crown className="text-slate-900" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">ChessFlow</h1>
              <p className="text-blue-100 text-sm">@{user.email?.split('@')[0] || 'player'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-0.5 hover:scale-105 transition-transform">
              {user.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                  {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'P'}
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-blue-100 hover:text-white hover:bg-blue-800 transition-all"
            >
              Logout
            </Button>
          </div>
        </div>
        
        {/* Level and XP Bar */}
        <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Level {user.level}</span>
            <span className="text-sm text-blue-100">
              <AnimatedCounter target={user.xp} duration={1500} />
              {" / "}{nextLevelXp} XP
            </span>
          </div>
          <Progress value={xpProgress} className="h-3 progress-glow" />
          <div className="flex items-center justify-between mt-2 text-xs text-blue-200">
            <span>
              <AnimatedCounter 
                target={user.totalPoints} 
                duration={2000} 
                suffix=" Total Points"
              />
            </span>
            <span className="flex items-center space-x-1">
              <Zap size={12} />
              <span>Rank #{userRankData?.rank || 3}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity Panel */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Button variant="link" className="text-blue-400 text-sm p-0">
            View All
          </Button>
        </div>
        
        <div className="space-y-3">
          {recentGames.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-slate-400">No recent games yet. Start playing!</p>
              </CardContent>
            </Card>
          ) : (
            recentGames.map((game: any, index: number) => {
              const isWin = game.winnerId === user.id;
              const isDraw = game.result === 'draw';
              const isLoss = !isWin && !isDraw;
              
              let resultIcon, resultText, resultColor, points;
              
              if (isWin) {
                resultIcon = Trophy;
                resultText = "Win";
                resultColor = "text-emerald-400";
                points = "+4 pts";
              } else if (isDraw) {
                resultIcon = Handshake;
                resultText = "Draw";
                resultColor = "text-slate-400";
                points = "+4 pts";
              } else {
                resultIcon = X;
                resultText = "Loss";
                resultColor = "text-red-400";
                points = "-2 pts";
              }
              
              const ResultIcon = resultIcon;
              
              return (
                <Card key={game.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isWin ? 'bg-emerald-500' : isDraw ? 'bg-slate-600' : 'bg-red-500'
                        }`}>
                          <ResultIcon className="text-white" size={12} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">vs. AI</p>
                          <p className="text-slate-400 text-xs">
                            {new Date(game.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold text-sm ${resultColor}`}>
                          {resultText}
                        </span>
                        <p className="text-slate-400 text-xs">{points}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Lower Section */}
      <div className="px-4 space-y-4">
        {/* Updates Panel */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Bell className="text-blue-400 mr-2" size={16} />
              Latest Updates
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-slate-300">🎉 New tournament mode available!</p>
              <p className="text-sm text-slate-300">⚡ Improved AI difficulty levels</p>
            </div>
          </CardContent>
        </Card>

        {/* Referral System */}
        <Card className="bg-gradient-to-r from-purple-600 to-purple-700 border-0">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Invite Friends</h3>
            <p className="text-purple-100 text-sm mb-3">Get 100 XP for each friend who joins!</p>
            <div className="flex space-x-2">
              <input 
                type="text" 
                value="CHESS2024" 
                readOnly 
                className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm text-white"
              />
              <Button 
                onClick={copyReferralCode}
                className="bg-white text-purple-600 hover:bg-purple-50"
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task System */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center justify-between">
              Daily Tasks
              <span className="text-sm text-slate-400">2/3 Complete</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">Win 2 games</p>
                  <Progress value={100} className="h-1.5 mt-1" />
                </div>
                <Button 
                  size="sm" 
                  className="ml-3 bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3"
                >
                  Claim
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">Play 5 games</p>
                  <Progress value={60} className="h-1.5 mt-1" />
                </div>
                <span className="ml-3 text-slate-400 text-xs">3/5</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
