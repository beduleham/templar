"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS, type UserRole } from "@/lib/navigation";

const SIGN_IN_ROLES: UserRole[] = ["client", "partner", "admin"];

const ROLE_BUTTON_STYLES: Record<string, string> = {
  client: "bg-vivid-blue text-white hover:opacity-90",
  partner: "bg-vivid-purple text-white hover:opacity-90",
  admin: "bg-vivid-mint text-white hover:opacity-90",
};

/**
 * Mock 로그인 화면.
 * Supabase Auth(소셜 OAuth·이메일) 연동은 후속 태스크에서 이 화면을 대체한다.
 */
export default function AuthPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const handleSignIn = (role: UserRole) => {
    signIn(role);
    toast.success(`${ROLE_LABELS[role]} 계정으로 로그인했습니다.`);
    router.push("/dashboard");
  };

  return (
    <div className="bg-card text-card-foreground w-full max-w-sm rounded-3xl border p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] lg:p-10">
      <div className="flex items-center gap-2.5">
        <span className="bg-vivid-blue flex size-9 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-sm">
          아
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tracking-tight">아칸</span>
          <span className="text-muted-foreground text-xs font-medium">
            Archon
          </span>
        </span>
      </div>
      <h1 className="mt-6 text-lg font-semibold">로그인</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        역할을 선택해 데모 계정으로 입장하세요. 실제 로그인(소셜/이메일)은 준비
        중입니다.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {SIGN_IN_ROLES.map((role) => (
          <Button
            key={role}
            className={ROLE_BUTTON_STYLES[role]}
            onClick={() => handleSignIn(role)}
          >
            {ROLE_LABELS[role]}로 시작하기
          </Button>
        ))}
      </div>
      <Separator className="my-6" />
      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="hover:text-foreground underline underline-offset-4">
          소개 페이지로 돌아가기
        </Link>
      </p>
    </div>
  );
}
