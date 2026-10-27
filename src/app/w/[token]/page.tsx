import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { loadPublicList, PublicList } from "@/modules/wishlist/public-list";

// Public share page of a wishlist (module "wishlist"). Works without signing in.

export async function generateMetadata({ params }: PageProps<"/w/[token]">): Promise<Metadata> {
  const list = await loadPublicList((await params).token);
  return {
    title: list ? `${list.name} · Wunschliste` : "Wunschliste",
    robots: { index: false, follow: false },
  };
}

export default function SharedWishlistPage({ params }: PageProps<"/w/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/w/[token]">["params"] }) {
  const { token } = await params;
  return <PublicList token={token} />;
}
