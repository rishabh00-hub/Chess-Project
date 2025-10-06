import { Crown } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "Loading ChessFlow..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
            <Crown className="text-slate-900" size={32} />
          </div>
          <div className="absolute inset-0 w-20 h-20 bg-yellow-400/30 rounded-2xl mx-auto animate-ping"></div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">ChessFlow</h2>
        <p className="text-slate-400 mb-6">{message}</p>
        
        <div className="flex justify-center space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}