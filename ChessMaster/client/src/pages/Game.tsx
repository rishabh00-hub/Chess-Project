import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ChessBoard from "@/components/ChessBoard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Flag, Users, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Game as GameType, User } from "@shared/schema";
import { useGameSocket } from "@/hooks/useGameSocket";

// Helper: build a displayable name from a User record
function getDisplayName(player: User | null | undefined, playerId: string, color: string): string {
  if (playerId === 'ai') return 'AI Opponent';
  if (!player) return `${color.charAt(0).toUpperCase() + color.slice(1)} Player`;
  const full = [player.firstName, player.lastName].filter(Boolean).join(' ');
  return full || player.username || `${color.charAt(0).toUpperCase() + color.slice(1)} Player`;
}

// Player profile row shown above/below the board
interface PlayerProfileProps {
  player: User | null | undefined;
  playerId: string;
  color: 'white' | 'black';
  aiDifficulty?: number | null;
  isActive: boolean;   // it is this player's turn
  isUser: boolean;     // this is the logged-in user
  isThinking?: boolean;
}

function PlayerProfile({ player, playerId, color, aiDifficulty, isActive, isUser, isThinking }: PlayerProfileProps) {
  const elo = playerId === 'ai'
    ? (aiDifficulty ?? 1200)
    : (player?.elo ?? null);

  return (
    <div
      data-testid={`player-info-${color}`}
      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 ${
        isActive
          ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)] bg-slate-700/60'
          : 'bg-slate-700/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
            color === 'white' ? 'bg-slate-200' : 'bg-slate-950'
          }`}
        >
          {color === 'white' ? '⚪' : '⚫'}
        </div>
        <div>
          <div className="flex items-center gap-2 font-medium text-sm text-white">
            {getDisplayName(player, playerId, color)}
            {isUser && <span className="text-xs text-slate-400">(You)</span>}
            {isActive && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <div className="text-xs text-slate-400">
            {elo !== null ? `Elo: ${elo}` : ''}
            {playerId === 'ai' && aiDifficulty ? ` · Difficulty ${aiDifficulty}` : ''}
          </div>
        </div>
      </div>
      {isThinking && (
        <div className="text-xs text-amber-400 animate-pulse pr-1">Thinking…</div>
      )}
    </div>
  );
}

export default function Game() {
  const [, params] = useRoute("/game/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const gameId = params?.id ? parseInt(params.id) : null;

  useGameSocket(gameId, (updatedGame) => {
    queryClient.setQueryData(['/api/games', gameId], updatedGame as GameType);
  });

  const { data: game, isLoading, error } = useQuery<GameType>({
    queryKey: ['/api/games', gameId],
    enabled: !!gameId,
  });

  // Fetch white player profile (skip for AI)
  const { data: whitePlayer } = useQuery<User | null>({
    queryKey: ['/api/user', game?.whitePlayerId],
    queryFn: async () => {
      const res = await fetch(`/api/user?userId=${game!.whitePlayerId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!game?.whitePlayerId && game.whitePlayerId !== 'ai',
  });

  // Fetch black player profile (skip for AI)
  const { data: blackPlayer } = useQuery<User | null>({
    queryKey: ['/api/user', game?.blackPlayerId],
    queryFn: async () => {
      const res = await fetch(`/api/user?userId=${game!.blackPlayerId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!game?.blackPlayerId && game.blackPlayerId !== 'ai',
  });

  const moveMutation = useMutation({
    mutationFn: async (move: { from: string; to: string; promotion?: string }) => {
      const response = await apiRequest('POST', `/api/games/${gameId}/move`, move);
      return await response.json();
    },
    onSuccess: (updatedGame: GameType) => {
      queryClient.setQueryData(['/api/games', gameId], updatedGame);
    }
  });

  const resignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/games/${gameId}/resign`, {});
      return await response.json();
    },
    onSuccess: (updatedGame: GameType) => {
      queryClient.setQueryData(['/api/games', gameId], updatedGame);
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

  const isPlayerTurn = user && ((game.whitePlayerId === user.id && game.currentTurn === 'white') || (game.blackPlayerId === user.id && game.currentTurn === 'black'));
  const playerColor = user && game.whitePlayerId === user.id ? 'white' : user && game.blackPlayerId === user.id ? 'black' : null;
  const isGameOver = game.status === 'completed';

  // Determine which side is the local user and which is the opponent
  const opponentColor: 'white' | 'black' = playerColor === 'white' ? 'black' : 'white';
  const opponentPlayerId = opponentColor === 'white' ? game.whitePlayerId : game.blackPlayerId;
  const userPlayerId = playerColor === 'white' ? game.whitePlayerId : game.blackPlayerId;
  const opponentPlayer = opponentColor === 'white' ? whitePlayer : blackPlayer;
  const userPlayerProfile = playerColor === 'white' ? whitePlayer : blackPlayer;

  const isOpponentTurn = game.currentTurn === opponentColor;
  const isUserTurn = game.currentTurn === playerColor;
  const isAIThinking = game.status === 'ai_thinking' || moveMutation.isPending;

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

        <Card className="p-4 bg-slate-800 border-slate-700 mb-6 flex flex-col gap-3">
          {/* Opponent profile – above the board */}
          <PlayerProfile
            player={opponentPlayer}
            playerId={opponentPlayerId}
            color={opponentColor}
            aiDifficulty={game.aiDifficulty}
            isActive={isOpponentTurn && !isGameOver}
            isUser={false}
            isThinking={isOpponentTurn && isAIThinking}
          />

          <ChessBoard
            size="large"
            interactive={!isGameOver}
            position={game.currentPosition || undefined}
            currentTurn={game.currentTurn as 'white' | 'black'}
            playerColor={playerColor || 'white'}
            onMove={handleMove}
            disabled={!isPlayerTurn || moveMutation.isPending || isGameOver}
            showStatus={true}
          />

          {/* User profile – below the board.
               userPlayerProfile is fetched from /api/user; fall back to the
               auth user object while that query is still loading. */}
          <PlayerProfile
            player={userPlayerProfile ?? (user as User | null | undefined)}
            playerId={userPlayerId ?? (user?.id ?? '')}
            color={playerColor ?? 'white'}
            isActive={!!isUserTurn && !isGameOver}
            isUser={true}
            isThinking={!!isUserTurn && moveMutation.isPending}
          />
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
