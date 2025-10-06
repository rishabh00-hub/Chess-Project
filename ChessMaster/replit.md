# ChessFlow - Mobile Chess Game Application

## Overview

ChessFlow is a modern, mobile-first chess game application built with React and Express. The application provides multiple game modes including AI opponents, friend matches, online matchmaking, and bet matches. It features a comprehensive tutorial system, global leaderboards, detailed statistics tracking, and a gamification system with levels, XP, and achievements.

The application uses a full-stack TypeScript architecture with a React frontend (Vite), Express backend, and PostgreSQL database (via Neon serverless). It's designed for deployment on Replit with built-in authentication support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript for type safety
- Vite as the build tool and dev server for fast development
- Wouter for lightweight client-side routing (SPA navigation)
- TailwindCSS for utility-first styling with custom chess theme

**UI Component System**
- Shadcn UI (Radix UI primitives) for accessible, composable components
- Custom components organized in `/client/src/components`:
  - `AnimatedCounter`: Smooth number animations for stats
  - `ChessBoard`: Interactive chess board visualization
  - `BottomNavigation`: Fixed mobile navigation bar
  - `FloatingActionButton`: Quick game creation with mode selection
  - `LoadingScreen`, `NotificationBanner`, `ParticleEffect`, `PulseAnimation`: Enhanced UX elements

**State Management**
- TanStack Query (React Query) for server state management and caching
- Custom hooks for authentication (`useAuth`, `useDemoAuth`)
- Query invalidation for real-time data updates

**Design Patterns**
- Mobile-first responsive design with max-width container (max-w-md)
- Dark theme optimized for chess gameplay (slate-900 background)
- Component composition with Radix UI Slot pattern
- Path aliases for clean imports (@/, @shared/, @assets/)

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for REST API
- ESM module system (type: "module")
- Middleware pipeline for logging, JSON parsing, and error handling

**API Structure**
- `/api/auth/*`: Authentication endpoints (Replit Auth integration)
- `/api/games/*`: Game CRUD operations and matchmaking
- `/api/leaderboard/*`: Global rankings and user rank
- `/api/tutorial/*`: Tutorial lessons and progress tracking
- Demo routes provided for UI showcase (auth temporarily disabled)

**Authentication Flow**
- Replit OpenID Connect (OIDC) integration via Passport.js
- Session management using PostgreSQL session store (connect-pg-simple)
- Cookie-based sessions with 7-day TTL
- User profile sync from Replit identity

**Data Layer**
- Repository pattern via `IStorage` interface in `server/storage.ts`
- `DatabaseStorage` implementation using Drizzle ORM
- Separation of concerns: routes → storage → database

### Database Architecture

**ORM & Schema**
- Drizzle ORM for type-safe database queries
- Schema definitions in `/shared/schema.ts` (shared between client/server)
- Drizzle-Zod for runtime validation from schema

**Tables**
1. **sessions**: Express session storage (sid, sess, expire)
2. **users**: User profiles with stats (id, email, name, level, xp, points, game stats, streaks)
3. **games**: Game records (id, players, mode, status, result, moves, timestamps)
4. **tutorialLessons**: Tutorial content (id, title, description, difficulty, content)
5. **userLessonProgress**: User tutorial tracking (userId, lessonId, completed, score)

**Key Design Decisions**
- PostgreSQL via Neon Serverless for edge-compatible deployment
- WebSocket constructor override for serverless compatibility
- Timestamps for all records (createdAt, updatedAt)
- Composite keys for progress tracking (userId + lessonId)

### Game Logic System

**Chess Engine** (`client/src/lib/chessEngine.ts`)
- Position management with FEN notation parsing
- Move validation (simplified implementation, extensible for full rules)
- Turn management and game state tracking

**Game Manager** (`client/src/lib/gameLogic.ts`)
- Game lifecycle management (create, join, move, complete)
- Multiple game mode support (AI, friend, online, bet)
- Time control integration (optional)
- Game state persistence

**Point System**
- Win/Draw: +4 points
- Lose/Resign: -2 points
- Level progression based on XP
- Streak tracking for consecutive wins

### Gamification & Progress

**Experience System**
- XP gained from games and tutorial completion
- Level-based progression with visual indicators
- Progress bars for XP and tutorial completion

**Statistics Tracking**
- Games played, wins, losses, draws, resignations
- Win rate calculation and display
- Current and best streak tracking
- Historical performance data

**Tutorial System**
- Progressive lesson structure with difficulty levels
- Interactive practice modes
- Score tracking per lesson
- Overall progress percentage

## External Dependencies

### Core Services

**Database**
- **Neon Serverless PostgreSQL**: Primary data store
- Connection via `@neondatabase/serverless` with WebSocket support
- Environment variable: `DATABASE_URL`

**Authentication**
- **Replit Auth (OpenID Connect)**: User authentication
- Required environment variables:
  - `REPLIT_DOMAINS`: Allowed domains for Replit deployment
  - `ISSUER_URL`: OIDC issuer (defaults to https://replit.com/oidc)
  - `REPL_ID`: Replit application identifier
  - `SESSION_SECRET`: Session encryption key

### Development Tools

**Replit Integration**
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- Replit development banner for external access

**Build & Development**
- Vite plugins: React, runtime error overlay, cartographer
- TypeScript with strict mode and path aliases
- PostCSS with Tailwind and Autoprefixer
- Drizzle Kit for database migrations

### UI & Styling

**Component Libraries**
- Radix UI primitives (30+ components for accessibility)
- Lucide React for icons
- class-variance-authority for variant management
- cmdk for command palette functionality

**Utilities**
- clsx & tailwind-merge for class name management
- date-fns for date formatting
- nanoid for unique ID generation
- memoizee for function memoization

### State & Data Fetching

**React Query** (`@tanstack/react-query`)
- Server state synchronization
- Automatic cache invalidation
- Optimistic updates
- Configurable retry logic with custom 401 handling

### Form Management

**React Hook Form** with Zod validation
- `@hookform/resolvers` for schema validation
- Integration with Drizzle-Zod schemas
- Type-safe form state management

### Session Management

**Express Session Infrastructure**
- `express-session` for session middleware
- `connect-pg-simple` for PostgreSQL session store
- Secure cookie configuration (httpOnly, secure flags)

### Development Scripts

- `dev`: Development server with hot reload (tsx + Vite HMR)
- `build`: Production build (Vite frontend + esbuild backend)
- `start`: Production server
- `db:push`: Apply database schema changes via Drizzle
- `check`: TypeScript type checking

### Notable Architecture Decisions

1. **Shared Schema**: Database schema in `/shared` accessible to both client and server for type consistency
2. **Demo Mode**: Authentication temporarily disabled with demo user data for UI development/showcase
3. **Mobile-First**: Optimized for mobile with max-width containers and bottom navigation
4. **Serverless Ready**: Neon database with WebSocket polyfill for edge deployment
5. **Type Safety**: End-to-end TypeScript with Drizzle ORM and Zod validation
6. **Error Handling**: Centralized error middleware with status code normalization
7. **Asset Management**: Separate attached_assets directory for design resources