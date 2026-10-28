// Amazon links: product id (ASIN), short links, a clean product URL and the
// affiliate tag. Wishes store the clean URL, so users can't bring their own
// tag; only the admin's AMAZON_PARTNER_TAG is added when guests see a link.

const AMAZON_HOST = /(^|\.)amazon\.(de|com|co\.uk|fr|it|es|nl|se|pl|com\.be|at|ca|com\.mx|co\.jp|in|com\.au|com\.tr)$/i;
// Short links from the app's share button (amzn.eu/d/…, amzn.to/…, a.co/d/…).
const SHORT_HOST = /^(amzn\.(eu|to|asia)|a\.co)$/i;
const ASIN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([A-Z0-9]{10})(?=[/?#]|$)/i;

function parse(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export const isAmazon = (url: string) => AMAZON_HOST.test(parse(url)?.hostname ?? "");
export const isAmazonShortLink = (url: string) => SHORT_HOST.test(parse(url)?.hostname ?? "");

export function amazonAsin(url: string) {
  const parsed = parse(url);
  if (!parsed || !AMAZON_HOST.test(parsed.hostname)) return null;
  return parsed.pathname.match(ASIN_PATH)?.[1].toUpperCase() ?? null;
}

// https://www.amazon.de/dp/B0…: without tracking parameters, someone
// else's affiliate tag or the long product slug.
export function cleanAmazonUrl(url: string) {
  const parsed = parse(url);
  const asin = amazonAsin(url);
  if (!parsed || !asin) return url;
  return `https://${parsed.hostname.replace(/^(m|smile)\./, "www.")}/dp/${asin}`;
}

// Any Amazon link without someone else's partner tag: product links become
// /dp/<ASIN>, others (e.g. searches) lose the tag parameters.
export function withoutAffiliate(url: string) {
  const parsed = parse(url);
  if (!parsed || !AMAZON_HOST.test(parsed.hostname)) return url;
  if (amazonAsin(url)) return cleanAmazonUrl(url);
  for (const key of ["tag", "linkCode", "linkId", "ascsubtag", "creative", "creativeASIN", "camp", "ref_"]) parsed.searchParams.delete(key);
  return parsed.toString();
}

// A search on Amazon, for wishes from a screenshot that has no link.
export function amazonSearchUrl(query: string) {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query.slice(0, 120))}`;
}

// The link guests open. Server only: reads AMAZON_PARTNER_TAG.
export function shopLink(url: string) {
  const tag = process.env.AMAZON_PARTNER_TAG;
  const parsed = parse(url);
  if (!tag || !parsed || !AMAZON_HOST.test(parsed.hostname)) return url;
  parsed.searchParams.set("tag", tag);
  return parsed.toString();
}

export const hasAffiliateLinks = (urls: (string | null)[]) =>
  Boolean(process.env.AMAZON_PARTNER_TAG) && urls.some((url) => url !== null && isAmazon(url));
