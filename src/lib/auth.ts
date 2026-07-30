import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email";
import { prepareAccountDeletion } from "@/lib/account-deletion";

export const auth = betterAuth({
  appName: "조직 일정 관리",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ email: user.email, url });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ email: user.email, url });
    },
  },
  user: {
    additionalFields: {
      consentedAt: {
        type: "date",
        required: true,
        input: true,
      },
      consentVersion: {
        type: "string",
        required: true,
        input: true,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const blockedOrganizationName = await prepareAccountDeletion(user.id);
        if (blockedOrganizationName) {
          throw new APIError("BAD_REQUEST", {
            message: `"${blockedOrganizationName}"의 소유권을 다른 구성원에게 이전한 뒤 탈퇴해 주세요.`,
          });
        }
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  advanced: {
    cookiePrefix: "org-schedule",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [nextCookies()],
});
