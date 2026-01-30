// Demo authentication for UI showcase
export function useDemoAuth() {
  const demoUser = {
    id: "demo_user_123",
    email: "player@chess.com",
    firstName: "Chess",
    lastName: "Master",
    profileImageUrl: null,
    level: 8,
    xp: 7250, // Keep for compatibility
    totalPoints: 1420, // Keep for compatibility
    elo: 1650,
    gamesPlayed: 156,
    wins: 89,
    losses: 42,
    draws: 18,
    resignations: 7,
    currentStreak: 5,
    bestStreak: 12,
    tutorialProgress: 75,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  };

  return {
    user: demoUser,
    isLoading: false,
    isAuthenticated: true,
  };
}