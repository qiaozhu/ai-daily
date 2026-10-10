// Open Graph / Twitter card tags for page URLs the Worker answers (PRD v6 §3.0): crawlers do not run JS, so the
// tags are injected into the static index.html (env.ASSETS) with HTMLRewriter. 404 pages never get them.

export interface OgMeta {
  /** og:title; the page <title> gets " · AI 热点日报" appended unless it already names the site */
  title: string;
  description: string;
  /** absolute URLs */
  url: string;
  image: string;
  type: 'website' | 'article';
}

export const SITE_NAME = 'AI 热点日报';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeAttr = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch] as string);

/** collapse whitespace and cut to `max` characters with an ellipsis */
export function clip(s: string | null | undefined, max: number): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...t].length > max ? [...t].slice(0, max - 1).join('') + '…' : t;
}

/** the og / twitter <meta> tags (one per line); the page description is replaced in place by injectOg */
export function ogTags(m: OgMeta): string {
  const tags: [string, string, string][] = [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', m.type],
    ['property', 'og:title', m.title],
    ['property', 'og:description', m.description],
    ['property', 'og:url', m.url],
    ['property', 'og:image', m.image],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:locale', 'zh_CN'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', m.title],
    ['name', 'twitter:description', m.description],
    ['name', 'twitter:image', m.image],
  ];
  return tags.map(([k, n, v]) => `<meta ${k}="${n}" content="${escapeAttr(v)}">`).join('\n');
}

const OG_SELECTOR = 'meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]';

/** index.html response -> same response with <title> and the description replaced and the tags appended to <head> */
export function injectOg(res: Response, m: OgMeta): Response {
  return new HTMLRewriter()
    .on(OG_SELECTOR, {
      element(el) {
        el.remove(); // never two sets of tags
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(m.title.includes(SITE_NAME) ? m.title : `${m.title} · ${SITE_NAME}`);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', m.description);
      },
    })
    .on('head', {
      element(el) {
        el.append(`\n${ogTags(m)}\n<link rel="canonical" href="${escapeAttr(m.url)}">\n`, { html: true });
      },
    })
    .transform(res);
}

/** drop any og / twitter / canonical tags (404 pages must not have them, PRD #26) */
export function stripOg(res: Response): Response {
  return new HTMLRewriter()
    .on(OG_SELECTOR, {
      element(el) {
        el.remove();
      },
    })
    .transform(res);
}
