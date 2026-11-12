// Server only: HTTP requests to addresses a user typed in (shop links). The
// server must not be usable to reach its own network (localhost, the cloud
// metadata service, private ranges), so every address a host name resolves to
// is checked, and the connection is made to exactly the checked address: the
// check runs inside the socket's DNS lookup, so a host can't answer with a
// public address for the check and a private one for the connection (DNS
// rebinding). Redirects are not followed; the caller checks each hop.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 3], // multicast and reserved (224.0.0.0 – 255.255.255.255)
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127], // unspecified and loopback
  ["64:ff9b::", 96], // NAT64: an IPv4 address inside
  ["64:ff9b:1::", 48], // local NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: an IPv4 address inside
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

// IPv4-mapped IPv6 (::ffff:a.b.c.d, also written ::ffff:7f00:1) as IPv4.
function mappedIpv4(address: string) {
  const match = address.toLowerCase().match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!match) return null;
  if (match[1]) return match[1];
  const high = parseInt(match[2], 16);
  const low = parseInt(match[3], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

// Whether an IP address is one the public internet can't reach. Anything that
// isn't a valid address counts as private.
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;
  const mapped = mappedIpv4(address);
  if (mapped) return isPrivateAddress(mapped);
  return blocked.check(address, "ipv6");
}

const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, "");

// Used as the socket's lookup: resolves the host and refuses it if any of its
// addresses is private.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, result) => {
    const addresses = (Array.isArray(result) ? result : []) as LookupAddress[];
    if (error) return callback(error, "", 4);
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      return callback(Object.assign(new Error("blocked host"), { code: "EBLOCKED" }), "", 4);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

export type PublicResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  // The body as text, cut off after maxBytes (after decompression).
  text: string;
};

// One GET request to a public http(s) address. Throws for private or
// unresolvable hosts and when the timeout runs out.
export function publicGet(
  url: URL,
  { headers = {}, timeoutMs, maxBytes = 0 }: { headers?: Record<string, string>; timeoutMs: number; maxBytes?: number },
): Promise<PublicResponse> {
  return new Promise((resolve, reject) => {
    if (url.protocol !== "http:" && url.protocol !== "https:") return reject(new Error("blocked protocol"));
    if (url.username || url.password) return reject(new Error("blocked host"));
    const host = bareHost(url);
    // An IP address in the URL never goes through the lookup, so it is checked here.
    if (isIP(host) ? isPrivateAddress(host) : /(^|\.)(localhost|internal|local)\.?$/i.test(host)) {
      return reject(new Error("blocked host"));
    }

    const timer = setTimeout(() => request.destroy(new Error("timeout")), timeoutMs);
    const fail = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        headers: { ...headers, "Accept-Encoding": "gzip, deflate, br" },
        lookup: publicLookup,
        // A fresh connection per request: a reused socket would skip the lookup.
        agent: false,
      },
      (response) => {
        const done = (text: string) => {
          clearTimeout(timer);
          request.destroy();
          resolve({ status: response.statusCode ?? 0, headers: response.headers, text });
        };
        if (maxBytes <= 0) return done("");

        const encoding = String(response.headers["content-encoding"] ?? "").trim().toLowerCase();
        const decoder =
          encoding === "gzip" || encoding === "x-gzip"
            ? createGunzip()
            : encoding === "deflate"
              ? createInflate()
              : encoding === "br"
                ? createBrotliDecompress()
                : null;
        const body = decoder ? response.pipe(decoder) : response;
        const chunks: Buffer[] = [];
        let size = 0;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          done(new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes)));
        };
        body.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= maxBytes) finish();
        });
        body.on("end", finish);
        // A cut-off or broken stream still leaves what was read so far.
        body.on("error", () => (size > 0 ? finish() : fail(new Error("unreadable response"))));
        response.on("error", () => (size > 0 ? finish() : fail(new Error("unreadable response"))));
      },
    );
    request.on("error", fail);
    request.end();
  });
}
