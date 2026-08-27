import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password.server";

const env = getServerEnv();

export const auth = betterAuth({
  appName: env.APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: ({ hash: hashValue, password }) => verifyPassword(hashValue, password),
    },
  },
  plugins: [admin()],
});
