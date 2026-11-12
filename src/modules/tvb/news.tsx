/* eslint-disable @next/next/no-img-element -- photos are small files in public/tvb */
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { categories, formatDate, photo, type News } from "./data";
import { container, display, href, SectionTitle } from "./site";

export function NewsCard({ news }: { news: News }) {
  const image = photo(news.image);
  return (
    <Link
      href={href("aktuelles", { id: news.id })}
      className="flex flex-col overflow-hidden rounded-[18px] border border-(--tvb-line) bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {image ? (
        <img src={image.src} alt={image.alt} className="h-[210px] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-[210px] items-center justify-center bg-(--tvb-soft)">
          <img src="/tvb/wappen.png" alt="" className="h-24 w-auto opacity-80" />
        </div>
      )}
      <div className="flex flex-col gap-2.5 p-5.5">
        <span className="text-[13px] font-semibold text-(--tvb-muted)">
          {formatDate(news.publishedOn)} · {news.category}
        </span>
        <h3 className="text-[21px] leading-snug font-bold">{news.title}</h3>
        {news.teaser && <p className="text-[15px] leading-relaxed text-[#4a504c]">{news.teaser}</p>}
      </div>
    </Link>
  );
}

export function NewsPage({ news, category }: { news: News[]; category: string | undefined }) {
  const shown = category ? news.filter((item) => item.category === category) : news;
  return (
    <>
      <PageHead eyebrow="Nichts verpassen" title="Aktuelles" />
      <section className={cn(container, "py-12")}>
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Kategorie">
          {[undefined, ...categories].map((option) => (
            <Link
              key={option ?? "alle"}
              href={href("aktuelles", option ? { kategorie: option } : {})}
              aria-current={option === category ? "page" : undefined}
              className="flex min-h-11 items-center rounded-full border-[1.5px] border-[#cfcdc4] bg-white px-4.5 text-[15px] font-bold aria-[current=page]:border-(--tvb-primary) aria-[current=page]:bg-(--tvb-primary) aria-[current=page]:text-white"
            >
              {option ?? "Alle"}
            </Link>
          ))}
        </nav>
        {shown.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-(--tvb-line) p-8 text-center text-(--tvb-muted)">Keine Meldungen in dieser Kategorie.</p>
        )}
      </section>
    </>
  );
}

export function NewsDetail({ news }: { news: News }) {
  const image = photo(news.image);
  return (
    <article className={cn(container, "max-w-[860px] py-12")}>
      <Link href={href("aktuelles")} className="mb-6 inline-flex min-h-11 items-center gap-2 font-semibold text-(--tvb-primary)">
        <ArrowLeftIcon className="size-4.5" /> Alle Meldungen
      </Link>
      <span className="block text-sm font-semibold text-(--tvb-muted)">
        {formatDate(news.publishedOn)} · {news.category}
      </span>
      <h1 className={cn(display, "mt-2 mb-6 text-[40px] leading-[0.95] sm:text-[56px]")}>{news.title}</h1>
      {image && <img src={image.src} alt={image.alt} className="mb-8 max-h-[460px] w-full rounded-[20px] object-cover" />}
      <div className="space-y-4 text-lg leading-relaxed text-[#2f3531]">
        {news.body.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}

export function PageHead({ eyebrow, title, intro, image }: { eyebrow: string; title: string; intro?: string; image?: { src: string } }) {
  return (
    <section className="relative overflow-hidden bg-(--tvb-deep) text-white">
      {image && (
        <img src={image.src} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover object-[center_25%] opacity-45 md:block" />
      )}
      <div className={cn(container, "relative py-14 lg:py-18")}>
        <SectionTitle eyebrow={eyebrow} title={title} light />
        {intro && <p className="mt-4 max-w-[560px] text-lg leading-relaxed opacity-90">{intro}</p>}
      </div>
    </section>
  );
}
