export type AuthRole = "user" | "admin";

export interface AuthSession {
  name: string;
  email: string;
  role: AuthRole;
  /**
   * E.164. Present once the account has been paired with an iMessage number.
   * When set it becomes the account identity, because it is the only value the
   * bridge can produce for a texting sender. See lib/auth/account.ts.
   */
  phone?: string | null;
}

export type AuthMode = "login" | "signup";
