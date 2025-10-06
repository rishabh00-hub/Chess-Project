import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardContent className="pt-6 text-center">
          <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Crown className="text-slate-900 text-3xl" size={32} />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">ChessFlow</h1>
          <p className="text-slate-400 mb-8">
            Master the game of chess with AI opponents, friends, and interactive lessons.
          </p>

          <div className="space-y-4 mb-6">
            <div className="text-left">
              <h3 className="font-semibold text-white mb-2">Features:</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Play against AI or friends</li>
                <li>• Global leaderboards</li>
                <li>• Interactive chess tutorials</li>
                <li>• Track your progress</li>
                <li>• Multiple game modes</li>
              </ul>
            </div>
          </div>

          <Button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
