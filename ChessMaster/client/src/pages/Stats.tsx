import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Stats() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

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

  // Calculate statistics
  const totalGames = user.gamesPlayed || 0;
  const winRate = totalGames > 0 ? ((user.wins || 0) / totalGames * 100).toFixed(1) : "0.0";
  
  // Calculate pie chart segments (simplified visual representation)
  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const draws = user.draws || 0;
  const resignations = user.resignations || 0;
  
  const winPercentage = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const lossPercentage = totalGames > 0 ? (losses / totalGames) * 100 : 0;
  const drawPercentage = totalGames > 0 ? (draws / totalGames) * 100 : 0;
  const resignationPercentage = totalGames > 0 ? (resignations / totalGames) * 100 : 0;

  // Generate fake weekly performance data for visualization
  const weeklyPerformance = [
    { day: 'Mon', result: 'win', height: '70%' },
    { day: 'Tue', result: 'loss', height: '40%' },
    { day: 'Wed', result: 'win', height: '90%' },
    { day: 'Thu', result: 'draw', height: '60%' },
    { day: 'Fri', result: 'win', height: '85%' },
    { day: 'Sat', result: 'win', height: '95%' },
    { day: 'Sun', result: 'loss', height: '35%' },
  ];

  const getBarColor = (result: string) => {
    switch (result) {
      case 'win': return 'bg-emerald-500';
      case 'loss': return 'bg-red-500';
      case 'draw': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold">Your Statistics</h1>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Win/Loss Record */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Match Record</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Pie Chart Representation */}
              <div className="relative">
                <div className="w-32 h-32 mx-auto relative">
                  {totalGames > 0 ? (
                    <div 
                      className="w-full h-full rounded-full" 
                      style={{
                        background: `conic-gradient(
                          #10B981 0deg ${winPercentage * 3.6}deg, 
                          #EF4444 ${winPercentage * 3.6}deg ${(winPercentage + lossPercentage) * 3.6}deg, 
                          #64748B ${(winPercentage + lossPercentage) * 3.6}deg ${(winPercentage + lossPercentage + drawPercentage) * 3.6}deg, 
                          #F59E0B ${(winPercentage + lossPercentage + drawPercentage) * 3.6}deg 360deg
                        )`
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-600" />
                  )}
                  <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{totalGames}</p>
                      <p className="text-xs text-slate-400">Total Games</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm">Wins: <span className="font-semibold">{wins}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Losses: <span className="font-semibold">{losses}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                  <span className="text-sm">Draws: <span className="font-semibold">{draws}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-sm">Resignations: <span className="font-semibold">{resignations}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Stats */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Game Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Average Game Length</span>
                <span className="font-semibold">18:42</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Win Rate</span>
                <span className="font-semibold text-emerald-400">{winRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Current Streak</span>
                <span className="font-semibold text-yellow-400">
                  {user.currentStreak} {user.currentStreak === 1 ? 'Game' : 'Games'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Best Streak</span>
                <span className="font-semibold text-blue-400">
                  {user.bestStreak} {user.bestStreak === 1 ? 'Game' : 'Games'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Trend */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Recent Performance</h3>
            {/* Simple bar chart representation */}
            <div className="flex items-end justify-between h-32 space-x-2">
              {weeklyPerformance.map((day, index) => (
                <div key={index} className="flex flex-col items-center space-y-2 flex-1">
                  <div 
                    className={`w-full rounded-t ${getBarColor(day.result)}`} 
                    style={{ height: day.height }}
                  />
                  <span className="text-xs text-slate-400">{day.day}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center space-x-4 mt-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Win</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Loss</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <span>Draw</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
