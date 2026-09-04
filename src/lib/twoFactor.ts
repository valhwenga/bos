/**
 * Two-factor authentication, using time-based one-time codes.
 *
 * The app has always had a "require two-factor" switch on roles and a toggle
 * per user. Both were written down and then ignored — nothing checked either,
 * so an administrator could turn 2FA "on" for the finance role and change
 * nothing at all. A security control that appears to be enabled and is not is
 * worse than one that is visibly off, because it stops anyone asking why.
 *
 * The factors themselves live in Supabase auth. This module is the app's view
 * of them: enrol, verify, and answer the question that actually matters at
 * sign-in — is this session as strong as this user's role demands?
 */

import { supabase } from "./supabase";

export type EnrollmentStart = {
  factorId: string;
  /** Rendered for the authenticator app to scan. */
  qrCodeSvg: string;
  /** The same secret, for typing in by hand when a camera is not available. */
  secret: string;
};

/**
 * How strong the current session is.
 *
 * `aal1` is a password alone; `aal2` means a second factor was also presented.
 * A session stays at aal1 until the code is verified, which is what makes the
 * check at sign-in meaningful.
 */
export type AssuranceLevel = "aal1" | "aal2" | null;

export const TwoFactor = {
  /** Verified factors on the signed-in account. */
  async listFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return data.totp ?? [];
  },

  async isEnrolled(): Promise<boolean> {
    try {
      const factors = await this.listFactors();
      return factors.some((f) => f.status === "verified");
    } catch {
      return false;
    }
  },

  /**
   * Begins enrolment and returns the QR code to scan.
   *
   * The factor exists but is unverified until a code from it is accepted, so
   * abandoning this leaves an inert factor rather than a half-enabled account.
   */
  async startEnrollment(friendlyName = "Authenticator app"): Promise<EnrollmentStart> {
    // A previous, never-completed attempt would otherwise collide on the name
    // and count against the enrolled-factor limit.
    for (const factor of await this.listFactors()) {
      if (factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });
    if (error) throw new Error(error.message);
    return {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
    };
  },

  /** Confirms enrolment with a code from the authenticator app. */
  async confirmEnrollment(factorId: string, code: string): Promise<void> {
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw new Error(challengeError.message);

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) throw new Error(friendlyCodeError(error.message));

    // Mirrored onto the profile so administrators can see who has it enabled
    // without querying auth. The factor in auth stays the source of truth.
    await this.syncProfileFlag(true);
  },

  /** Answers a challenge at sign-in, raising the session to aal2. */
  async verifyCode(code: string): Promise<void> {
    const factors = await this.listFactors();
    const factor = factors.find((f) => f.status === "verified");
    if (!factor) throw new Error("No authenticator is set up on this account.");

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError) throw new Error(challengeError.message);

    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) throw new Error(friendlyCodeError(error.message));
  },

  async unenroll(): Promise<void> {
    for (const factor of await this.listFactors()) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw new Error(error.message);
    }
    await this.syncProfileFlag(false);
  },

  /**
   * Whether this session still owes a code.
   *
   * Supabase reports the level the session has and the level it *could* reach.
   * They differ exactly when a verified factor exists but has not been used
   * yet, which is the state a sign-in has to stop at.
   */
  async needsChallenge(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
  },

  async assuranceLevel(): Promise<AssuranceLevel> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return null;
    return (data.currentLevel as AssuranceLevel) ?? null;
  },

  async syncProfileFlag(enabled: boolean): Promise<void> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("profiles").update({ two_factor_enabled: enabled }).eq("id", data.user.id);
  },
};

/** Supabase's wording here is opaque; the cause is nearly always the same. */
function friendlyCodeError(message: string): string {
  if (/invalid|verification failed|challenge/i.test(message)) {
    return "That code was not accepted. Codes last 30 seconds, so try the current one — and check your phone's clock is set automatically.";
  }
  return message;
}
