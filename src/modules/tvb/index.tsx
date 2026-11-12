import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import { AdminPage, LoginPage } from "./admin";
import { ClubPage } from "./club";
import { newsColumns, newsFromRow, type NewsRow } from "./data";
import { HomePage } from "./home";
import { MembershipPage } from "./membership";
import { NewsDetail, NewsPage } from "./news";
import { Banner, Footer, Header, href, type PageId } from "./site";
import { Shell } from "./shell";
import { TeamsPage } from "./teams";

// TV Bellenberg: prototype of the tennis club's new website. It covers the
// app's header so it looks like the real site; the header's "Private Lab"
// button leads back. Pages switch with ?seite=… and render on the server, as
// the real site would. Users with access to the module are its admins and
// edit the news under ?seite=admin; if the module is made public, everyone
// sees the published news.

const pageIds: PageId[] = ["start", "aktuelles", "mannschaften", "verein", "mitglied", "login", "admin"];

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function TvbModule({ user, hasAccess, searchParams }: ModulePageProps) {
  const params = await searchParams;
  const requested = param(params.seite) as PageId | undefined;
  const page: PageId = requested && pageIds.includes(requested) ? requested : "start";

  if (page === "login" && user && hasAccess) redirect(href("admin"));
  if (page === "admin" && !(user && hasAccess)) redirect(href("login"));

  // RLS: admins get drafts too; everyone else only published news.
  const supabase = await createClient();
  const { data } = await supabase
    .from("tvb_news")
    .select(newsColumns)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });
  const all = ((data ?? []) as NewsRow[]).map(newsFromRow);
  const published = all.filter((item) => item.published);

  let content: React.ReactNode;
  switch (page) {
    case "aktuelles": {
      const id = param(params.id);
      if (id) {
        const item = (hasAccess ? all : published).find((news) => news.id === id);
        if (!item) notFound();
        content = <NewsDetail news={item} />;
      } else {
        content = <NewsPage news={published} category={param(params.kategorie)} />;
      }
      break;
    }
    case "mannschaften":
      content = <TeamsPage seasonId={param(params.saison)} />;
      break;
    case "verein":
      content = <ClubPage />;
      break;
    case "mitglied":
      content = <MembershipPage />;
      break;
    case "login":
      content = <LoginPage signedIn={Boolean(user)} />;
      break;
    case "admin":
      content = <AdminPage news={all} editing={param(params.bearbeiten)} saved={params.gespeichert === "1"} />;
      break;
    default:
      content = <HomePage news={published} />;
  }

  return (
    <Shell>
      <Banner news={published.find((item) => item.showBanner)} />
      <Header current={page} />
      <div>{content}</div>
      <Footer />
    </Shell>
  );
}
