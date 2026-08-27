import { authClient } from "@/lib/auth-client";

export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

type AuthClientResult = {
  error?: unknown;
};

export type EmailSignIn = (credentials: {
  email: string;
  password: string;
}) => Promise<AuthClientResult>;

export type SignOut = () => Promise<AuthClientResult>;

const defaultEmailSignIn: EmailSignIn = (credentials) => authClient.signIn.email(credentials);
const defaultSignOut: SignOut = () => authClient.signOut();

export async function signInWithEmail(
  email: string,
  password: string,
  signIn: EmailSignIn = defaultEmailSignIn,
) {
  try {
    const result = await signIn({ email: email.trim(), password });

    if (result.error) {
      return { ok: false as const, message: INVALID_CREDENTIALS_MESSAGE };
    }

    return { ok: true as const, redirectTo: "/dashboard" as const };
  } catch {
    return { ok: false as const, message: INVALID_CREDENTIALS_MESSAGE };
  }
}

export async function signOutCurrentSession(signOut: SignOut = defaultSignOut) {
  try {
    const result = await signOut();
    if (result.error) {
      return { ok: false as const };
    }

    return { ok: true as const, redirectTo: "/login" as const };
  } catch {
    return { ok: false as const };
  }
}
