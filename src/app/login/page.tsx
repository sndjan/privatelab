import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm opacity-70">
          Enter your email and we&apos;ll send you a magic link. Only invited addresses can sign in.
        </p>
      </div>
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;

  return (
    <>
      {error && (
        <p className="rounded border border-red-500/40 p-3 text-sm text-red-600">
          The sign-in link was invalid or has expired. Please request a new one.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
