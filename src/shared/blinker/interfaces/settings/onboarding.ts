// API //
export interface BlinkerOnboardingAPI {
  /**
   * Finishes the onboarding process
   */
  finish: () => void;

  /**
   * Resets the onboarding process
   */
  reset: () => void;
}
