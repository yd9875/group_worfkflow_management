import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { createHash, createCipheriv, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const secret = process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-me-please";

function protectJoinCode(value: string) {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

async function makeUser(name: string, email: string) {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      emailVerified: true,
      consentedAt: new Date(),
      consentVersion: "2026-07-30",
    },
    update: { name, emailVerified: true },
  });
  const password = await hashPassword("Schedule!2026");
  await prisma.account.upsert({
    where: { id: `seed-account-${user.id}` },
    create: {
      id: `seed-account-${user.id}`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password,
    },
    update: { password },
  });
  return user;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("운영 환경에서는 시드를 실행할 수 없습니다.");
  }
  const users = await Promise.all([
    makeUser("김소유", "owner@example.com"),
    makeUser("이관리", "admin@example.com"),
    makeUser("박운영", "member1@example.com"),
    makeUser("최지원", "member2@example.com"),
    makeUser("정기획", "member3@example.com"),
    makeUser("한개발", "member4@example.com"),
    makeUser("오대기", "pending@example.com"),
  ]);
  const joinCode = "TEAM2026";
  const organization = await prisma.organization.upsert({
    where: { joinCodeHash: createHash("sha256").update(joinCode).digest("hex") },
    create: {
      name: "함께하는 조직",
      description: "조직 일정 관리 개발 시드",
      joinCodeHash: createHash("sha256").update(joinCode).digest("hex"),
      joinCodeCiphertext: protectJoinCode(joinCode),
    },
    update: {},
  });
  const departmentNames = ["운영팀", "지원팀", "미지정"];
  const departments = await Promise.all(
    departmentNames.map((name, index) =>
      prisma.department.upsert({
        where: { organizationId_name: { organizationId: organization.id, name } },
        create: {
          organizationId: organization.id,
          name,
          sortOrder: index,
          isSystem: name === "미지정",
        },
        update: {},
      }),
    ),
  );
  await Promise.all(users.slice(0, 6).map((user, index) =>
    prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      create: {
        userId: user.id,
        organizationId: organization.id,
        departmentId: departments[index % 2].id,
        role: index === 0 ? "OWNER" : index === 1 ? "ADMIN" : "MEMBER",
      },
      update: {},
    }),
  ));
  const pendingExists = await prisma.joinRequest.findFirst({ where: { userId: users[6].id, organizationId: organization.id, status: "PENDING" } });
  if (!pendingExists) await prisma.joinRequest.create({ data: { userId: users[6].id, organizationId: organization.id } });
  await prisma.schedule.deleteMany({ where: { organizationId: organization.id } });
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  await prisma.schedule.createMany({
    data: [
      { organizationId: organization.id, createdByUserId: users[0].id, updatedByUserId: users[0].id, title: "전사 주간회의", description: "이번 주 우선순위 공유", startsAt: new Date(monday.getTime() + 9 * 3600000), endsAt: new Date(monday.getTime() + 10 * 3600000), scope: "ORGANIZATION", category: "MEETING", isImportant: true },
      { organizationId: organization.id, createdByUserId: users[1].id, updatedByUserId: users[1].id, title: "운영 프로세스 교육", startsAt: new Date(monday.getTime() + 2 * 86400000 + 13 * 3600000), endsAt: new Date(monday.getTime() + 2 * 86400000 + 16 * 3600000), scope: "DEPARTMENT", departmentId: departments[0].id, category: "TRAINING" },
      { organizationId: organization.id, createdByUserId: users[2].id, updatedByUserId: users[2].id, title: "연차", startsAt: new Date(monday.getTime() + 4 * 86400000), endsAt: new Date(monday.getTime() + 5 * 86400000), isAllDay: true, scope: "PERSONAL", targetUserId: users[2].id, category: "LEAVE" },
      { organizationId: organization.id, createdByUserId: users[0].id, updatedByUserId: users[0].id, title: "분기 전략 워크숍", startsAt: new Date(monday.getTime() + 8 * 86400000 + 9 * 3600000), endsAt: new Date(monday.getTime() + 8 * 86400000 + 18 * 3600000), scope: "ORGANIZATION", category: "MEETING", isImportant: true },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: users[0].id,
      organizationId: organization.id,
      type: "SEED_NOTICE",
      title: "일정 관리가 준비되었습니다",
      body: "주간표와 월간 캘린더를 둘러보세요.",
    },
  });
  console.info("개발 시드 완료: owner@example.com / Schedule!2026, 가입 코드 TEAM2026");
}

main().finally(() => prisma.$disconnect());
