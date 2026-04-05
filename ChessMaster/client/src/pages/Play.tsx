import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { 
      Play as PlayIcon, Bot, Users, Globe, Loader2, ArrowLeft, BrainCircuit
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type GameMode = 'ai' | 'friend' | 'online';

export default function Play() {
      const { user, isLoading } = useAuth();
        const { toast } = useToast();
          const [, setLocation] = useLocation();
            
              const [isMatchmaking, setIsMatchmaking] = useState(false);
                const [showAiDifficulty, setShowAiDifficulty] = useState(false);
                  const [aiElo, setAiElo] = useState<number>(1200);

                    useEffect(() => {
                            if (!isLoading && !user) {
                                      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
                                            setTimeout(() => window.location.href = "/", 500);
                            }
                    }, [user, isLoading, toast]);

                      const getEloTitle = (elo: number) => {
                            if (elo < 1000) return "Beginner";
                                if (elo < 1400) return "Intermediate";
                                    if (elo < 1800) return "Advanced";
                                        return "Expert";
                      };

                        const createGameMutation = useMutation({
                                mutationFn: async ({ mode }: { mode: GameMode }) => {
                                          const gameData = {
                                                    whitePlayerId: user?.id || 'player', // FIXED: No more 'demo_user_123'
                                                            blackPlayerId: null,
                                                                    gameMode: mode,
                                                                            status: 'active',
                                                                                    aiDifficulty: mode === 'ai' ? aiElo : undefined // Explicitly use slider state value
                                          };
                                          const response = await apiRequest('POST', '/api/games', gameData);
                                          return await response.json();
                                },
                                    onSuccess: (data: any) => {
                                              setIsMatchmaking(false);
                                                    toast({ title: "Game Created!", description: "Starting your match..." });
                                                          setLocation(`/game/${data.id || data.ID}`);
                                    },
                                        onError: () => {
                                                  setIsMatchmaking(false);
                                                        toast({ title: "Error", description: "Failed to create game.", variant: "destructive" });
                                        },
                        });

                          const handleGameModeSelect = (mode: GameMode) => {
                                if (mode === 'ai') {
                                          setShowAiDifficulty(true);
                                                return;
                                }
                                    if (mode === 'friend') {
                                              createGameMutation.mutate({ mode }); // FIXED: Instant creation, no fake loader
                                                    return;
                                    }
                                        if (mode === 'online') {
                                                  setIsMatchmaking(true);
                                                        setTimeout(() => createGameMutation.mutate({ mode }), 2000); // Online still has matchmaking loader
                                        }
                          };

                            if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

                              return (
                                    <div className="pb-20">
                                          <div className="px-4 pt-12 pb-6 flex items-center space-x-3">
                                                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                                                            <PlayIcon className="text-white" size={20} />
                                                                    </div>
                                                                            <h1 className="text-2xl font-bold">Play Chess</h1>
                                                                                  </div>

                                                                                        {showAiDifficulty ? (
                                                                                                    <div className="px-4 mb-8">
                                                                                                              <Button variant="ghost" className="mb-4 text-slate-400 pl-0" onClick={() => setShowAiDifficulty(false)}>
                                                                                                                          <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                                                                                                                    </Button>
                                                                                                                                              
                                                                                                                                                        <Card className="bg-slate-800 border-slate-600 mb-6">
                                                                                                                                                                    <CardContent className="p-6 text-center">
                                                                                                                                                                                  <BrainCircuit className="mx-auto mb-4 h-12 w-12 text-purple-400" />
                                                                                                                                                                                                <h2 className="text-xl font-bold mb-1">Set AI Strength</h2>
                                                                                                                                                                                                              
                                                                                                                                                                                                                            <div className="mb-8 mt-6">
                                                                                                                                                                                                                                            <div className="flex justify-between items-end mb-4">
                                                                                                                                                                                                                                                              <span className="text-3xl font-bold text-white">{aiElo}</span>
                                                                                                                                                                                                                                                                                <span className="text-purple-400 font-medium">{getEloTitle(aiElo)}</span>
                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                <Slider
                                                                                                                                                                                                                                                                                                                                                  defaultValue={[1200]} min={600} max={2100} step={100}
                                                                                                                                                                                                                                                                                                                                                                    onValueChange={(val) => setAiElo(val[0])}
                                                                                                                                                                                                                                                                                                                                                                                      className="w-full"
                                                                                                                                                                                                                                                                                                                                                                                                      />
                                                                                                                                                                                                                                                                                                                                                                                                                    </div>

                                                                                                                                                                                                                                                                                                                                                                                                                                  <Button 
                                                                                                                                                                                                                                                                                                                                                                                                                                                  onClick={() => createGameMutation.mutate({ mode: 'ai' })}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                  disabled={createGameMutation.isPending}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                >
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                {createGameMutation.isPending ? "Starting..." : "Play vs AI"}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </Button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </CardContent>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </Card>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                        ) : !isMatchmaking ? (
                                                                                                    <div className="px-4 mb-8">
                                                                                                              <div className="space-y-3">
                                                                                                                          {[
                                                                                                                                          { id: 'ai' as GameMode, title: 'vs AI', desc: 'Practice against computer', icon: Bot, bg: 'bg-purple-500' },
                                                                                                                                                        { id: 'friend' as GameMode, title: 'vs Friend', desc: 'Invite via link or code', icon: Users, bg: 'bg-blue-500' },
                                                                                                                                                                      { id: 'online' as GameMode, title: 'Online Match', desc: 'Find random opponent', icon: Globe, bg: 'bg-emerald-500' }
                                                                                                                          ].map((mode) => (
                                                                                                                                          <Card key={mode.id} className="bg-slate-800 hover:bg-slate-700 border-slate-600 cursor-pointer" onClick={() => handleGameModeSelect(mode.id)}>
                                                                                                                                                          <CardContent className="p-4 flex items-center space-x-4">
                                                                                                                                                                            <div className={`w-12 h-12 ${mode.bg} rounded-xl flex items-center justify-center`}>
                                                                                                                                                                                                <mode.icon className="text-white" size={20} />
                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                    <div>
                                                                                                                                                                                                                                                        <h3 className="font-semibold">{mode.title}</h3>
                                                                                                                                                                                                                                                                            <p className="text-sm text-slate-400">{mode.desc}</p>
                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                              </CardContent>
                                                                                                                                                                                                                                                                                                                            </Card>
                                                                                                                          ))}
                                                                                                                                    </div>
                                                                                                                                            </div>
                                                                                        ) : (
                                                                                                    <div className="px-4">
                                                                                                              <Card className="bg-slate-800 border-slate-700">
                                                                                                                          <CardContent className="p-8 text-center">
                                                                                                                                        <Loader2 className="text-emerald-400 animate-spin mx-auto mb-4" size={40} />
                                                                                                                                                      <h3 className="text-lg font-semibold">Finding Opponent...</h3>
                                                                                                                                                                  </CardContent>
                                                                                                                                                                            </Card>
                                                                                                                                                                                    </div>
                                                                                        )}
                                                                                            </div>
                              );
}
