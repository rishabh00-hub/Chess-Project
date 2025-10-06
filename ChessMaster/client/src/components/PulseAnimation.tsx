import { ReactNode } from "react";

interface PulseAnimationProps {
  children: ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export default function PulseAnimation({ 
  children, 
  intensity = 'medium',
  className = ""
}: PulseAnimationProps) {
  const getIntensityClass = () => {
    switch (intensity) {
      case 'low':
        return 'animate-pulse duration-3000';
      case 'high':
        return 'animate-pulse duration-1000';
      default:
        return 'animate-pulse duration-2000';
    }
  };

  return (
    <div className={`${getIntensityClass()} ${className}`}>
      {children}
    </div>
  );
}