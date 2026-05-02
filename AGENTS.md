# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm start                        # Start Expo dev server
expo run:android                 # Build and run on Android
expo run:ios                     # Build and run on iOS
expo start --web                 # Run web version
npm run lint                     # Run ESLint

# API integration test scripts
node scripts/test-fatsecret.mjs
node scripts/test-usda.mjs
node scripts/test-openfoodfacts.mjs
```

## Architecture

React Native fitness tracking app built with **Expo** (multi-platform: iOS, Android, Web). Spanish-language UI.

### Tech Stack

- **Routing:** Expo Router (file-based, `app/` directory)
- **Backend:** Supabase (PostgreSQL with RLS, Auth, Storage)
- **State:** React Context API — no Redux/Zustand
- **Auth:** Supabase Auth + Google Sign-In + Apple Sign-In
- **UI/Graphics:** React Native, @shopify/react-native-skia, victory-native (charts)
- **Animations:** react-native-reanimated
- **Fonts:** Space Grotesk, Space Mono, Doto (via @expo-google-fonts)
- **Icons:** Ionicons (@expo/vector-icons)
- **Path alias:** `@/*` maps to project root

### Directory Structure

```
app/               # Expo Router file-based routes
  index.tsx        # Entry: auth check + onboarding detection
  (auth)/          # Login, signup, password recovery, email confirm
  (onboarding)/    # First-run user setup (personal info, goals)
  (tabs)/          # Bottom tab navigation (5 tabs)
    inicio/        # Home/dashboard
    (nutricion)/   # Food logging & nutrition tracking
    (entrenamiento)/  # Workout sessions, routines, exercises
    (ia)/          # AI chatbot
    (perfil)/      # Profile, settings, subscription plan
    (progreso)/    # Progress metrics, weight history, stats

components/        # Reusable UI (nutrition/, entrenamiento/, navigation/, ui/, ia/, progreso/)
context/           # React Contexts (Auth, Entreno, Theme, ComidaPortapapeles)
hooks/             # Custom hooks (useAuth, useEntreno, useNutricion, usePerfil, useTheme, etc.)
lib/               # Utilities (supabase.ts, date/nutrition helpers, translation via LibreTranslate)
services/          # Supabase query layer (auth, nutrition, workout, food, exercises, profile, AI)
types/             # TypeScript defs (database.types.ts = Supabase schema, app.types.ts)
constants/         # config.ts (env vars), theme.ts (design tokens), default meal data
```

### State Management

Four React Contexts, each with a companion hook:

| Context | Hook | Purpose |
|---|---|---|
| `AuthContext` | `useAuth` | Supabase session, user object |
| `EntrenoContext` | `useEntreno` | Active workout state + 1s timer |
| `ThemeContext` | `useTheme` | Light/dark theme |
| `ComidaPortapapelesContext` | — | Transient meal draft data |

Session persistence uses AsyncStorage (via Supabase client in `lib/supabase.ts`). Non-critical preferences (meal order, popular foods) are stored in AsyncStorage; sensitive tokens use expo-secure-store.

### Navigation

5-tab bottom nav. Groups with parentheses `(group)/` create nested stacks without appearing as tabs. The minimized workout bar renders over the tab bar when a workout is active (reads `useEntreno`).

### Database Schema (key tables)

`Profile`, `UserGoal`, `UserBodyMetric`, `Food` (tiers: master/reference/brand; sources: builtin/fatsecret/usda/openfoodfacts/custom), `NutritionLog`, `NutritionLogItem`, `WorkoutSession`, `WorkoutSessionExercise`, `WorkoutSet`, `Exercise`, `Routine`, `AIMessage`

### Environment Variables

Configured via `.env` (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- USDA FoodData Central API key
- LibreTranslate endpoint
- Google Sign-In client ID

### SVG Support

Metro is configured with `react-native-svg-transformer` (`metro.config.js`). Import SVGs as React components directly.
