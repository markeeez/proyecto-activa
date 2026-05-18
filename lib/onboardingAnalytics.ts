export type OnboardingEvent =
  | 'onboarding_started'
  | 'goal_selected'
  | 'profile_basics_completed'
  | 'plan_confirmed'
  | 'starter_routine_created'
  | 'first_meal_logged'
  | 'first_workout_started'
  | 'activation_completed';

export function trackOnboardingEvent(
  event: OnboardingEvent,
  properties?: Record<string, string | number | boolean | null>,
) {
  // Punto unico para conectar un proveedor real de analytics mas adelante.
  console.info('[onboarding]', event, properties ?? {});
}
