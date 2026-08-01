export const PRIVACY_POLICY_VERSION = "2026-07-30";

export const SIGNUP_PRIVACY_NOTICE = {
  purpose:
    "회원 식별·인증, 조직 입장 및 승인, 일정·알림 서비스 제공, 부정 이용 방지와 서비스 보안",
  requiredItems:
    "이름, 이메일, 비밀번호(일방향 암호화 저장), 동의 일시와 정책 버전",
  automaticItems: "접속 IP, 브라우저·기기 정보, 서비스 이용 기록",
  retention:
    "회원 탈퇴 시까지. 관계 법령에 따라 보존할 의무가 있는 정보는 해당 기간 동안 분리 보관",
  refusal:
    "동의를 거부할 수 있으나 필수정보 수집에 동의하지 않으면 회원가입과 서비스 이용이 제한됩니다.",
} as const;
