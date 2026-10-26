import { CircleAlertIcon } from "lucide-react";
import { Suspense } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a magic link. Only invited addresses can sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>The sign-in link was invalid or has expired. Please request a new one.</AlertDescription>
        </Alert>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
