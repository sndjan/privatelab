import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { FireApp } from "./app";
import { defaultSettings } from "./calc";
import { Calculator } from "./calculator";

export default async function FireModule({ user, hasAccess }: ModulePageProps) {
  // Visitors of a public FIRE module get the calculator without saved data.
  if (!user || !hasAccess) {
    return (
      <div className="space-y-10">
        <div className="max-w-xl space-y-3">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Wann könntest du aufhören zu arbeiten?</h2>
          <p className="text-[17px] text-muted-foreground">
            Probier den FIRE-Rechner mit deinen eigenen Zahlen aus. Es wird nichts gespeichert.
            {!user && (
              <>
                {" "}
                <Link href="/login?next=/m/fire" className="text-brand underline underline-offset-4">
                  Melde dich an
                </Link>
                , um dein Vermögen über die Zeit zu verfolgen.
              </>
            )}
          </p>
        </div>
        <Calculator
          netWorth={50000}
          startMonth={`${currentMonth()}-01`}
          settings={{ ...defaultSettings, monthlyIncome: 3000, monthlyExpenses: 2000 }}
        />
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          FIRE-Zahl = jährliche Ausgaben ÷ Entnahmerate. Die Prognose verzinst monatlich mit der erwarteten realen Rendite
          und rechnet deine monatliche Sparrate dazu.
        </p>
      </div>
    );
  }

  return (
    <Prefetch queries={[dataQuery("fire", "overview")]}>
      <Suspense fallback={<Loading />}>
        <FireApp />
      </Suspense>
    </Prefetch>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
