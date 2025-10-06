import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ChessBoard from "@/components/ChessBoard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Flag, Users, Trophy, Clock } from "lucide-react";
import type { Game as GameType } from "@shared/schema";

export default function Game() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const gameId = params?.id ? parseInt(params.id) : null;

  const { data: game, isLoading, error } = useQuery<GameType>({
    queryKey: ['/api/games', gameId],
    enabled: !!gameId,
    refetchInterval: (query) => {
      const game = query.state.data;
      if (game?.status === 'active' && game?.currentTurn === 'black' && game?.blackPlayerId === 'ai') {
        return 1000;
      }
      return game?.status === 'active' ? 3000 : false;
    }
  });

  const moveMutation = useMutation({
    mutationFn: async (move: { from: string; to: string; promotion?: string }) => {
      return apiRequest('POST', `/api/games/${gameId}/move`, move);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
    }
  });

  const resignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/games/${gameId}/resign`, { userId: 'demo_user_123' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games', gameId] });
    }
  });

  const handleMove = (move: { from: string; to: string; promotion?: string }) => {
    moveMutation.mutate(move);
  };

  const handleResign = () => {
    if (confirm('Are you sure you want to resign?')) {
      resignMutation.mutate();
    }
  };

  const handleBackToMenu = () => {
    setLocation('/play');
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
        <Card className="p-6 bg-slate-800 border-slate-700">
          <h2 className="text-xl font-bold mb-4">Game Not Found</h2>
          <Button onClick={() => setLocation('/play')} data-testid="button-back-to-menu">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
        <Card className="p-6 bg-slate-800 border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-red-400">Error Loading Game</h2>
          <p className="mb-4 text-slate-300">Could not load the game. Please try again.</p>
          <Button onClick={() => setLocation('/play')} data-testid="button-back-to-menu">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </Card>
      </div>
    );
  }

  const isPlayerTurn = game.currentTurn === 'white';
  const isGameOver = game.status === 'completed';
  const getResultMessage = () => {
    if (!isGameOver) return null;
    if (game.result === 'white_wins') return '⚪ White wins!';
    if (game.result === 'black_wins') return '⚫ Black wins!';
    if (game.result === 'draw') return '🤝 Draw';
    return 'Game Over';
  };

  const getGameModeLabel = () => {
    switch (game.gameMode) {
      case 'ai': return `vs AI ${game.aiDifficulty ? `(${game.aiDifficulty})` : ''}`;
      case 'friend': return 'vs Friend';
      case 'online': return 'Online Match';
      case 'bet': return `Bet Match (${game.betAmount} pts)`;
      default: return game.gameMode;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackToMenu}
            className="text-slate-300 hover:text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Users className="h-4 w-4" />
            {getGameModeLabel()}
          </div>
        </div>

        {isGameOver && (
          <Card className="mb-6 p-6 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-yellow-300" />
            <h2 className="text-2xl font-bold mb-2" data-testid="text-result">
              {getResultMessage()}
            </h2>
            <p className="text-sm opacity-90">
              {game.fullMoveNumber && `Game lasted ${game.fullMoveNumber} moves`}
            </p>
          </Card>
        )}

        <Card className="p-6 bg-slate-800 border-slate-700 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3" data-testid="player-info-black">
              <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-xl">
                ⚫
              </div>
              <div>
                <div className="font-medium">
                  {game.blackPlayerId === 'ai' ? 'AI Opponent' : 'Black Player'}
                </div>
                <div className="text-xs text-slate-400">
                  {game.gameMode === 'ai' && game.aiDifficulty && `Difficulty: ${game.aiDifficulty}`}
                </div>
              </div>
            </div>
            {moveMutation.isPending && game.currentTurn === 'black' && (
              <div className="text-sm text-amber-400 animate-pulse">
                Thinking...
              </div>
            )}
          </div>

          <ChessBoard
            size="large"
            interactive={!isGameOver}
            position={game.currentPosition || undefined}
            currentTurn={game.currentTurn as 'white' | 'black'}
            onMove={handleMove}
            disabled={!isPlayerTurn || moveMutation.isPending || isGameOver}
            showStatus={true}
          />

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-3" data-testid="player-info-white">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xl">
                ⚪
              </div>
              <div>
                <div className="font-medium">You (White)</div>
                <div className="text-xs text-slate-400">
                  {isPlayerTurn && !isGameOver ? 'Your turn' : ''}
                </div>
              </div>
            </div>
            {moveMutation.isPending && game.currentTurn === 'white' && (
              <div className="text-sm text-amber-400 animate-pulse">
                Making move...
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          {!isGameOver && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleResign}
              disabled={resignMutation.isPending}
              data-testid="button-resign"
            >
              <Flag className="mr-2 h-4 w-4" />
              {resignMutation.isPending ? 'Resigning...' : 'Resign'}
            </Button>
          )}
          {isGameOver && (
            <Button
              className="flex-1"
              onClick={() => setLocation('/play')}
              data-testid="button-new-game"
            >
              New Game
            </Button>
          )}
        </div>

        {game.moveHistory && game.moveHistory.trim() && (
          <Card className="mt-6 p-4 bg-slate-800 border-slate-700">
            <h3 className="font-medium mb-2 text-sm text-slate-300">Move History</h3>
            <div className="text-xs text-slate-400 font-mono">
              {game.moveHistory}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
