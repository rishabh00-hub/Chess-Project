import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Play as PlayIcon, 
  Bot, 
  Users, 
  Globe, 
  Coins,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import type { Game } from "@shared/schema";

type GameMode = 'ai' | 'friend' | 'online' | 'bet';

export default function Play() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  const createGameMutation = useMutation({
    mutationFn: async (gameMode: GameMode) => {
      const gameData = {
        whitePlayerId: 'demo_user_123',
        blackPlayerId: gameMode === 'ai' ? 'ai' : null,
        gameMode,
        status: 'active',
        aiDifficulty: gameMode === 'ai' ? 'medium' : null
      };
      const response = await apiRequest('POST', '/api/games', gameData);
      return await response.json();
    },
    onSuccess: (data: Game) => {
      setIsMatchmaking(false);
      toast({
        title: "Game Created!",
        description: "Starting your chess game...",
      });
      setLocation(`/game/${data.id}`);
    },
    onError: (error) => {
      setIsMatchmaking(false);
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
      });
    },
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

  const handleGameModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setIsMatchmaking(true);
    
    // Simulate matchmaking delay
    setTimeout(() => {
      createGameMutation.mutate(mode);
    }, 2000);
  };

  const cancelMatchmaking = () => {
    setIsMatchmaking(false);
    setSelectedMode(null);
  };

  const gameModes = [
    {
      id: 'ai' as GameMode,
      title: 'vs AI',
      description: 'Practice against computer',
      icon: Bot,
      bgColor: 'bg-purple-500',
      cardStyle: 'bg-slate-800 hover:bg-slate-700 border-slate-600'
    },
    {
      id: 'friend' as GameMode,
      title: 'vs Friend',
      description: 'Invite via link or code',
      icon: Users,
      bgColor: 'bg-blue-500',
      cardStyle: 'bg-slate-800 hover:bg-slate-700 border-slate-600'
    },
    {
      id: 'online' as GameMode,
      title: 'Online Matchmaking',
      description: 'Find random opponent',
      icon: Globe,
      bgColor: 'bg-emerald-500',
      cardStyle: 'bg-slate-800 hover:bg-slate-700 border-slate-600'
    },
    {
      id: 'bet' as GameMode,
      title: 'Bet Matches',
      description: 'Wager points for bigger rewards',
      icon: Coins,
      bgColor: 'bg-black/20',
      cardStyle: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
    }
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <PlayIcon className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold">Play Chess</h1>
        </div>
      </div>

      {!isMatchmaking ? (
        <div className="px-4 mb-8">
          <h2 className="text-lg font-semibold mb-4">Choose Game Mode</h2>
          <div className="space-y-3">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              
              return (
                <Card 
                  key={mode.id}
                  className={`${mode.cardStyle} border transition-colors cursor-pointer`}
                  onClick={() => handleGameModeSelect(mode.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 ${mode.bgColor} rounded-xl flex items-center justify-center`}>
                        <Icon className="text-white" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{mode.title}</h3>
                        <p className={`text-sm ${
                          mode.id === 'bet' ? 'text-yellow-100' : 'text-slate-400'
                        }`}>
                          {mode.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        // Matchmaking Interface
        <div className="px-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center">
                <Loader2 className="text-white animate-spin" size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Finding Opponent...</h3>
              <p className="text-slate-400 text-sm mb-6">
                {selectedMode === 'ai' ? 'Preparing AI opponent' :
                 selectedMode === 'friend' ? 'Waiting for friend to join' :
                 selectedMode === 'online' ? 'Searching for players at your level' :
                 'Finding worthy opponent for bet match'}
              </p>
              <Button 
                variant="destructive"
                onClick={cancelMatchmaking}
                disabled={createGameMutation.isPending}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
