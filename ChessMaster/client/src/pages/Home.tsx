import { useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
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
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AnimatedCounter from "@/components/AnimatedCounter";
import BottomNavigation from "@/components/BottomNavigation";

export default function Home() {
  // Initiate Zoho OAuth2 login redirect
  const handleZohoLogin = () => {
    // Construct Zoho OAuth2 URL
    const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
    console.log("Client ID:", clientId);
    const redirectUri = encodeURIComponent(import.meta.env.VITE_ZOHO_REDIRECT_URI);
    const scope = encodeURIComponent("AaaServer.profile.READ,ZohoCreator.data.CREATE,ZohoCreator.data.READ,ZohoCreator.data.UPDATE,ZohoCreator.meta.READ");
    const responseType = "code";
    const authUrl = `https://accounts.zoho.in/oauth/v2/auth?scope=${scope}&client_id=${clientId}&response_type=${responseType}&access_type=offline&redirect_uri=${redirectUri}&prompt=consent`;
    window.location.href = authUrl;
  };
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle auth state changes - invalidate queries when user logs in
  useEffect(() => {
    if (user && !isLoading) {
      // User is now authenticated - invalidate and refetch all queries
      queryClient.invalidateQueries();
      toast({
        title: "Welcome back!",
        description: "Successfully logged in to ChessFlow.",
      });
    }
  }, [user, isLoading, queryClient, toast]);

  // Handle login=success redirect (legacy support)
  useEffect(() => {
    if (window.location.search.includes('login=success')) {
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { data: recentGames = [] } = useQuery({
    queryKey: ["/api/games/user/recent"],
    retry: false,
  });

  const { data: userRankData } = useQuery({
    queryKey: ["/api/leaderboard/rank"],
    retry: false,
  });

  // Redirect to login if not authenticated
  // Show Zoho Sign In/Sign Up button if not authenticated
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Crown className="text-slate-900 text-3xl" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ChessFlow</h1>
            <p className="text-slate-400 mb-8">
              Sign in or sign up to track your progress, play matches, and join leaderboards!
            </p>
            <Button 
              onClick={handleZohoLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-3"
            >
              Sign In / Sign Up (Via Zoho)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

      // XP and level logic (replace with elo for new system)
      const xpProgress = ((user?.elo ?? 0) % 1000) / 1000 * 100;
      const nextLevelXp = (Math.floor((user?.elo ?? 0) / 1000) + 1) * 1000;

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
      {/* No achievement notification: currentStreak not in ZohoUserProfile */}

      {/* Top Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center animate-pulse">
              <Crown className="text-slate-900" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">ChessFlow</h1>
                  <p className="text-blue-100 text-sm">@{user?.email?.split('@')[0] || 'player'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-0.5 hover:scale-105 transition-transform">
                  {/* No profileImageUrl in User, fallback to initials */}
                  <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                    {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'P'}
                  </div>
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
                <span className="text-sm font-medium">Elo {user?.elo ?? 1200}</span>
            <span className="text-sm text-blue-100">
                  <AnimatedCounter target={user?.elo ?? 1200} duration={1500} />
                  {" / "}{nextLevelXp} Elo
            </span>
          </div>
          <Progress value={xpProgress} className="h-3 progress-glow" />
          <div className="flex items-center justify-between mt-2 text-xs text-blue-200">
            <span>
                  <AnimatedCounter 
                    target={user?.gamesPlayed ?? 0}
                    duration={2000}
                    suffix=" Games Played"
              />
            </span>
            <span className="flex items-center space-x-1">
              <Zap size={12} />
              <span>Rank #{(userRankData as any)?.rank ?? 3}</span>
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
          {(recentGames as any[]).length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-slate-400">No recent games yet. Start playing!</p>
              </CardContent>
            </Card>
          ) : (
            (recentGames as any[]).map((game: any) => {
                  const isWin = game.winnerId === user?.id;
              const isDraw = game.result === 'draw';
              // const isLoss = !isWin && !isDraw;
              
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
                          <p className="font-medium text-sm">vs. {game.blackPlayerId === user?.id ? game.whitePlayerId : game.blackPlayerId || 'Opponent'}</p>
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
      {/* Removed Referral System, Daily Tasks, and Latest Updates for production cleanup */}
      <BottomNavigation/>
    </div>
    );
  }