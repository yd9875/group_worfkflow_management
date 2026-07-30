import nodemailer from "nodemailer";

type EmailInput = { to: string; subject: string; text: string; html: string };

async function sendMail(input: EmailInput) {
  const isLogMode =
    process.env.EMAIL_DELIVERY_MODE === "log" || !process.env.SMTP_HOST;

  if (isLogMode) {
    console.info(
      JSON.stringify({
        event: "email.preview",
        to: input.to,
        subject: input.subject,
        preview: input.text,
      }),
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  });

  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "조직 일정 관리 <no-reply@example.com>",
    ...input,
  });

  console.info(
    JSON.stringify({
      event: "email.sent",
      recipientDomain: input.to.split("@").at(-1),
      subject: input.subject,
      messageId: result.messageId,
    }),
  );
}

export function sendVerificationEmail(input: { email: string; url: string }) {
  return sendMail({
    to: input.email,
    subject: "[조직 일정 관리] 이메일을 인증해 주세요",
    text: `이메일 인증 링크: ${input.url}`,
    html: `<p>아래 링크를 눌러 이메일 인증을 완료해 주세요.</p><p><a href="${input.url}">이메일 인증하기</a></p>`,
  });
}

export function sendPasswordResetEmail(input: { email: string; url: string }) {
  return sendMail({
    to: input.email,
    subject: "[조직 일정 관리] 비밀번호 재설정",
    text: `비밀번호 재설정 링크: ${input.url}`,
    html: `<p>아래 링크에서 새 비밀번호를 설정해 주세요.</p><p><a href="${input.url}">비밀번호 재설정</a></p>`,
  });
}
