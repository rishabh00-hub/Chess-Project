import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";

export default function Leaderboard() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["/api/leaderboard"],
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

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-500" size={16} />;
    if (rank === 2) return <Medal className="text-slate-400" size={16} />;
    if (rank === 3) return <Award className="text-amber-600" size={16} />;
    return <span className="text-xs font-bold">{rank}</span>;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-500 text-black";
    if (rank === 2) return "bg-slate-400 text-black";
    if (rank === 3) return "bg-amber-600 text-white";
    return "bg-slate-600 text-white";
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 pt-12 pb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Trophy className="text-amber-500" size={20} />
          </div>
          <h1 className="text-2xl font-bold">Global Rankings</h1>
        </div>
        
        {/* Point System Info */}
        <Card className="bg-black/20 border-0">
          <CardContent className="p-4">
            <p className="text-amber-100 text-sm mb-2">Point System:</p>
            <div className="flex justify-between text-sm">
              <span>Win/Draw: +4 pts</span>
              <span>Lose/Resign: -2 pts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table */}
      <div className="px-4 py-6">
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          {/* Header Row */}
          <div className="bg-slate-700 px-4 py-3 grid grid-cols-4 gap-4 text-sm font-semibold">
            <span>Rank</span>
            <span>Player</span>
            <span>Level</span>
            <span>Points</span>
          </div>
          
          {/* Data Rows */}
          <div className="divide-y divide-slate-700">
            {leaderboard.map((player: any, index: number) => {
              const rank = index + 1;
              const isCurrentUser = player.id === user.id;
              
              return (
                <div 
                  key={player.id} 
                  className={`px-4 py-3 grid grid-cols-4 gap-4 items-center text-sm ${
                    isCurrentUser ? 'bg-blue-900/30' : ''
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getRankBadgeColor(rank)}`}>
                      {rank <= 3 ? getRankIcon(rank) : rank}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {player.profileImageUrl ? (
                      <img 
                        src={player.profileImageUrl} 
                        alt="Player" 
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                        {player.firstName?.[0] || player.email?.[0]?.toUpperCase() || 'P'}
                      </div>
                    )}
                    <span className={isCurrentUser ? 'font-semibold' : ''}>
                      {isCurrentUser ? 'You' : (player.firstName || player.email?.split('@')[0] || 'Player')}
                    </span>
                  </div>
                  <span>{player.level}</span>
                  <span className={`font-semibold ${
                    rank === 1 ? 'text-yellow-400' : 
                    rank === 2 ? 'text-slate-300' : 
                    rank === 3 ? 'text-amber-400' : 
                    isCurrentUser ? 'text-blue-400' : 'text-white'
                  }`}>
                    {player.totalPoints.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Current User Row (if not in top results) */}
          {userRankData && userRankData.rank > leaderboard.length && (
            <div className="bg-blue-900/50 border-t-2 border-blue-500 px-4 py-3 grid grid-cols-4 gap-4 items-center text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
                  {userRankData.rank}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {user.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="You" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'P'}
                  </div>
                )}
                <span className="font-semibold">You</span>
              </div>
              <span>{user.level}</span>
              <span className="font-semibold text-blue-400">{user.totalPoints.toLocaleString()}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
