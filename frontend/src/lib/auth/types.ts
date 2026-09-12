export type AuthRole = "user" | "admin";

export interface AuthSession {
  name: string;
  email: string;
  role: AuthRole;
}

export type AuthMode = "login" | "signup";
