import { useState } from "react";
import { X, Bell, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationBannerProps {
  type: 'achievement' | 'update' | 'reminder';
  title: string;
  message: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export default function NotificationBanner({
  type,
  title,
  message,
  onDismiss,
  autoHide = true,
  duration = 5000
}: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const getIcon = () => {
    switch (type) {
      case 'achievement':
        return <Trophy className="text-yellow-400" size={20} />;
      case 'update':
        return <Bell className="text-blue-400" size={20} />;
      case 'reminder':
        return <Star className="text-purple-400" size={20} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'achievement':
        return 'bg-gradient-to-r from-yellow-600 to-orange-600';
      case 'update':
        return 'bg-gradient-to-r from-blue-600 to-indigo-600';
      case 'reminder':
        return 'bg-gradient-to-r from-purple-600 to-pink-600';
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (autoHide && duration) {
    setTimeout(() => {
      setIsVisible(false);
    }, duration);
  }

  if (!isVisible) return null;

  return (
    <div className={`${getBgColor()} p-4 mb-4 rounded-lg shadow-lg border-0 animate-in slide-in-from-top duration-300`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white mb-1">{title}</h4>
          <p className="text-sm text-white/90">{message}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}