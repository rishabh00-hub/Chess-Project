import { useState } from "react";
import { Play, Plus, X, Bot, Users, Globe, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Game } from "@shared/schema";

export default function FloatingActionButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createGameMutation = useMutation({
    mutationFn: async (gameMode: string) => {
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
    onSuccess: (data: Game, gameMode) => {
      toast({
        title: "Game Created!",
        description: `Starting ${gameMode} game...`,
      });
      setIsExpanded(false);
      setLocation(`/game/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGameModeSelect = (mode: string) => {
    createGameMutation.mutate(mode);
  };

  const gameModes = [
    { id: 'ai', icon: Bot, label: 'vs AI', color: 'bg-purple-500' },
    { id: 'friend', icon: Users, label: 'vs Friend', color: 'bg-blue-500' },
    { id: 'online', icon: Globe, label: 'Online', color: 'bg-emerald-500' },
    { id: 'bet', icon: Coins, label: 'Bet Match', color: 'bg-amber-500' },
  ];

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {/* Game Mode Options */}
      {isExpanded && (
        <div className="mb-4 space-y-3 animate-in slide-in-from-bottom duration-300">
          {gameModes.map((mode, index) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                className="flex items-center space-x-3 animate-in slide-in-from-right duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {mode.label}
                </span>
                <Button
                  onClick={() => handleGameModeSelect(mode.id)}
                  disabled={createGameMutation.isPending}
                  className={`w-12 h-12 rounded-full ${mode.color} hover:scale-110 transition-all shadow-lg`}
                >
                  <Icon className="text-white" size={20} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-xl hover:scale-110 transition-all duration-300 ${
          isExpanded ? 'rotate-45' : ''
        }`}
      >
        {isExpanded ? (
          <X className="text-white" size={24} />
        ) : (
          <Play className="text-white" size={24} />
        )}
      </Button>
    </div>
  );
}