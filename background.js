importScripts("detector.js");

const REQUEST_TIMEOUT_MS = 2400;
const MAX_SITEMAPS_TO_FETCH = 8;
const MAX_SITEMAP_URLS = 650;
const MAX_BLOG_EXAMPLES = 4;
const CONTENT_SITEMAP_PATTERNS = [
  /(^|[-_/])post(s)?([-_.]|$)/i,
  /(^|[-_/])article(s)?([-_.]|$)/i,
  /(^|[-_/])blog([-_.]|$)/i,
  /(^|[-_/])news([-_.]|$)/i,
  /(^|[-_/])noticia(s)?([-_.]|$)/i,
  /(^|[-_/])insight(s)?([-_.]|$)/i,
  /(^|[-_/])conteudo(s)?([-_.]|$)/i,
  /(^|[-_/])materia(s)?([-_.]|$)/i,
  /wp-sitemap-posts-post/i
];
const NON_CONTENT_SITEMAP_PATTERNS = [
  /(^|[-_/])page(s)?([-_.]|$)/i,
  /(^|[-_/])product(s)?([-_.]|$)/i,
  /(^|[-_/])category([-_.]|$)/i,
  /(^|[-_/])tag(s)?([-_.]|$)/i,
  /(^|[-_/])author(s)?([-_.]|$)/i,
  /(^|[-_/])attachment(s)?([-_.]|$)/i,
  /wp-sitemap-posts-page/i
];

function add(signals, cms, label, detail, weight, source, url) {
  signals.push({ cms, label, detail, weight, source, url });
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function originFromUrl(url) {
  try {
    return new URL(url).origin;
  } catch (_) {
    return "";
  }
}

function withTimeout(signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  signal.addEventListener("abort", () => controller.abort(), { once: true });

  return {
    signal: controller.signal,
    done: () => clearTimeout(timeout)
  };
}

async function fetchWithTimeout(url, options = {}) {
  const parentController = new AbortController();
  const timeout = withTimeout(parentController.signal);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      ...options,
      signal: timeout.signal
    });

    return response;
  } finally {
    timeout.done();
  }
}

function inspectHeaders(signals, response, url) {
  const headers = {};
  for (const [key, value] of response.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  const combined = lower(Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\n"));

  if (combined.includes("wp-json") || combined.includes("api.w.org")) {
    add(signals, "wordpress", "Headers WordPress REST", "Link/header contem wp-json ou api.w.org", 45, "headers", url);
  }
  if (combined.includes("wordpress")) {
    add(signals, "wordpress", "Header WordPress", "Header menciona WordPress", 35, "headers", url);
  }
  if (combined.includes("x-shopify") || combined.includes("shopify")) {
    add(signals, "shopify", "Headers Shopify", "Header menciona Shopify", 42, "headers", url);
  }
  if (combined.includes("x-wix") || combined.includes("wix")) {
    add(signals, "wix", "Headers Wix", "Header menciona Wix", 36, "headers", url);
  }
  if (combined.includes("x-drupal") || combined.includes("drupal")) {
    add(signals, "drupal", "Headers Drupal", "Header menciona Drupal", 38, "headers", url);
  }
  if (combined.includes("x-generator") && combined.includes("joomla")) {
    add(signals, "joomla", "Headers Joomla", "X-Generator Joomla", 42, "headers", url);
  }
  if (combined.includes("x-magento") || combined.includes("magento")) {
    add(signals, "magento", "Headers Magento", "Header menciona Magento", 38, "headers", url);
  }
  if (combined.includes("squarespace")) {
    add(signals, "squarespace", "Headers Squarespace", "Header menciona Squarespace", 38, "headers", url);
  }
  if (combined.includes("hubspot")) {
    add(signals, "hubspot", "Headers HubSpot", "Header menciona HubSpot", 38, "headers", url);
  }

  return headers;
}

async function probeCurrentPage(signals, pageUrl) {
  const response = await fetchWithTimeout(pageUrl, {
    method: "HEAD"
  });

  inspectHeaders(signals, response, pageUrl);

  if (response.url && response.url !== pageUrl) {
    const redirected = lower(response.url);
    if (redirected.includes("myshopify.com")) {
      add(signals, "shopify", "Redirecionamento Shopify", response.url, 35, "network", response.url);
    }
    if (redirected.includes("wixsite.com")) {
      add(signals, "wix", "Redirecionamento Wix", response.url, 35, "network", response.url);
    }
  }
}

async function probeWordPress(signals, origin) {
  await Promise.allSettled([
    probeWordPressJson(signals, origin),
    probeWordPressEndpoint(signals, origin, "/wp-login.php"),
    probeWordPressEndpoint(signals, origin, "/xmlrpc.php")
  ]);
}

async function probeWordPressJson(signals, origin) {
  const wpJsonUrl = `${origin}/wp-json/`;

  try {
    const response = await fetchWithTimeout(wpJsonUrl, {
      method: "GET",
      headers: {
        "accept": "application/json"
      }
    });

    inspectHeaders(signals, response, wpJsonUrl);

    const contentType = lower(response.headers.get("content-type"));
    if (response.ok && contentType.includes("json")) {
      const data = await response.json();
      const payload = JSON.stringify(data).slice(0, 25000);
      if (payload.includes('"wp/v2"') || payload.includes('"namespaces"') && payload.includes("wp/")) {
        add(signals, "wordpress", "Endpoint /wp-json/", "REST API WordPress respondeu JSON valido", 55, "network", wpJsonUrl);
      }
    }
  } catch (_) {
    // Sites podem bloquear /wp-json/; a ausencia de resposta nao invalida outros sinais.
  }
}

async function probeWordPressEndpoint(signals, origin, path) {
  const url = `${origin}${path}`;

  try {
    const response = await fetchWithTimeout(url, { method: "HEAD" });
    const server = lower(response.headers.get("server"));
    if ([200, 301, 302, 405].includes(response.status)) {
      add(signals, "wordpress", `Endpoint ${path}`, `status ${response.status}${server ? `, server ${server}` : ""}`, 14, "network", url);
    }
  } catch (_) {
    // Probes leves e opcionais.
  }
}

async function probeCommonFiles(signals, origin) {
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const response = await fetchWithTimeout(robotsUrl, { method: "GET" });
    if (!response.ok) return;

    const body = lower((await response.text()).slice(0, 20000));
    if (body.includes("wp-admin") || body.includes("wp-content")) {
      add(signals, "wordpress", "robots.txt WordPress", "robots.txt menciona wp-admin/wp-content", 22, "network", robotsUrl);
    }
    if (body.includes("/administrator/") && body.includes("joomla")) {
      add(signals, "joomla", "robots.txt Joomla", "robots.txt menciona administrator/Joomla", 22, "network", robotsUrl);
    }
    if (body.includes("/sites/default/")) {
      add(signals, "drupal", "robots.txt Drupal", "robots.txt menciona /sites/default/", 22, "network", robotsUrl);
    }
  } catch (_) {
    // robots.txt e opcional.
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function absolutizeUrl(url, origin) {
  try {
    return new URL(url, origin).href;
  } catch (_) {
    return "";
  }
}

function extractLocs(xml) {
  const locs = [];
  const pattern = /<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi;
  let match = pattern.exec(xml);

  while (match) {
    locs.push(decodeXml(match[1].trim()));
    match = pattern.exec(xml);
  }

  return locs;
}

function extractSitemapsFromRobots(body, origin) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => absolutizeUrl(line.replace(/^sitemap\s*:/i, "").trim(), origin))
    .filter(Boolean);
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function looksLikeSitemap(url) {
  const value = lower(url);
  return value.includes("sitemap") || value.endsWith(".xml") || value.endsWith(".xml.gz");
}

function hasAnyPattern(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function isContentSitemap(url) {
  const value = lower(url);
  return hasAnyPattern(value, CONTENT_SITEMAP_PATTERNS) && !hasAnyPattern(value, NON_CONTENT_SITEMAP_PATTERNS);
}

function isNonContentSitemap(url) {
  return hasAnyPattern(lower(url), NON_CONTENT_SITEMAP_PATTERNS);
}

function classifyContentUrl(url, sourceSitemap) {
  let path = "";

  try {
    const parsed = new URL(url);
    path = lower(parsed.pathname);
  } catch (_) {
    path = lower(url);
  }

  const source = lower(sourceSitemap);
  const excluded = [
    "/category/",
    "/tag/",
    "/author/",
    "/page/",
    "/wp-content/",
    "/wp-json/",
    "/wp-admin/",
    "/feed/",
    "/search/",
    "/login",
    "/cart",
    "/checkout",
    "/account",
    "/minha-conta",
    "/conta",
    "/privacy",
    "/privacidade",
    "/terms",
    "/termos",
    "/politica",
    "/contato",
    "/contact",
    "/sobre",
    "/about",
    "/servico",
    "/servicos",
    "/service",
    "/services",
    "/produto/",
    "/produtos/",
    "/product/",
    "/products/",
    "/loja/",
    "/shop/",
    "/product-category/",
    "/portfolio-category/"
  ];

  if (excluded.some((part) => path.includes(part))) {
    return null;
  }

  if (isContentSitemap(source)) {
    return "post_sitemap";
  }

  const blogPatterns = [
    "/blog/",
    "/artigo/",
    "/artigos/",
    "/insight/",
    "/insights/",
    "/noticia/",
    "/noticias/",
    "/news/",
    "/conteudo/",
    "/conteudos/",
    "/materia/",
    "/materias/"
  ];

  if (blogPatterns.some((part) => path.includes(part))) {
    return "blog_path";
  }

  if (/\/20[0-9]{2}\/[01][0-9]\//.test(path)) {
    return "dated_post";
  }

  return null;
}

function summarizeSitemap(urls, fetchedSitemaps) {
  const seenUrls = new Set();
  const uniqueUrls = [];
  const contentUrls = [];
  const blogSignals = new Set();

  for (const item of urls) {
    if (!item || !item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    uniqueUrls.push(item);
    if (uniqueUrls.length >= MAX_SITEMAP_URLS) break;
  }

  for (const item of uniqueUrls) {
    const contentType = classifyContentUrl(item.url, item.source);
    if (contentType) {
      contentUrls.push(item.url);
      blogSignals.add(contentType);
    }
  }

  const uniqueContentUrls = unique(contentUrls);
  const examples = uniqueContentUrls.slice(0, MAX_BLOG_EXAMPLES);

  return {
    checked: true,
    status: fetchedSitemaps.length ? "found" : "missing",
    sitemapsChecked: fetchedSitemaps,
    totalUrlsFound: uniqueUrls.length,
    contentUrlsFound: uniqueContentUrls.length,
    hasBlog: uniqueContentUrls.length > 0,
    blogSignals: Array.from(blogSignals),
    examples,
    message: uniqueContentUrls.length
      ? `${uniqueContentUrls.length} URL(s) de conteudo/artigo encontradas no sitemap.`
      : fetchedSitemaps.length
        ? "Sitemap encontrado, mas sem URLs claras de blog/artigos."
        : "Nao encontrei sitemap publico nos caminhos rapidos."
  };
}

async function fetchSitemapBatch(urls) {
  const uniqueUrls = unique(urls).slice(0, MAX_SITEMAPS_TO_FETCH);
  const responses = await Promise.allSettled(uniqueUrls.map(async (url) => ({
    url,
    xml: await fetchSitemapXml(url)
  })));

  return responses
    .filter((result) => result.status === "fulfilled" && result.value.xml)
    .map((result) => result.value);
}

async function readRobotsForSitemaps(origin) {
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetchWithTimeout(robotsUrl, { method: "GET" });
    if (!response.ok) return [];
    const body = await response.text();
    return extractSitemapsFromRobots(body.slice(0, 50000), origin);
  } catch (_) {
    return [];
  }
}

async function fetchSitemapXml(url) {
  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "accept": "application/xml,text/xml,text/plain,*/*"
      }
    });

    if (!response.ok) return null;

    const contentType = lower(response.headers.get("content-type"));
    if (contentType && !contentType.includes("xml") && !contentType.includes("text") && !contentType.includes("octet-stream")) {
      return null;
    }

    return (await response.text()).slice(0, 900000);
  } catch (_) {
    return null;
  }
}

function prioritizeSitemaps(urls) {
  return unique(urls)
    .filter(looksLikeSitemap)
    .sort((a, b) => {
      const aRank = sitemapPriority(a);
      const bRank = sitemapPriority(b);
      if (aRank !== bRank) return aRank - bRank;
      return a.length - b.length;
    })
    .slice(0, MAX_SITEMAPS_TO_FETCH);
}

function sitemapPriority(url) {
  if (isContentSitemap(url)) return 0;
  if (/sitemap(_index)?\.xml$|wp-sitemap\.xml$/i.test(url)) return 1;
  if (isNonContentSitemap(url)) return 3;
  return 2;
}

async function collectSitemapEvidence(origin) {
  const defaultSitemaps = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/post-sitemap.xml`,
    `${origin}/article-sitemap.xml`,
    `${origin}/blog-sitemap.xml`,
    `${origin}/news-sitemap.xml`
  ];
  const robotsPromise = readRobotsForSitemaps(origin);
  const firstBatch = prioritizeSitemaps(defaultSitemaps);
  const fetchedSitemaps = [];
  const discoveredUrls = [];
  const childSitemaps = [];

  const [robotsSitemaps, firstResults] = await Promise.all([
    robotsPromise,
    fetchSitemapBatch(firstBatch)
  ]);

  for (const result of firstResults) {
    fetchedSitemaps.push(result.url);
    const locs = extractLocs(result.xml);
    childSitemaps.push(...locs.filter(looksLikeSitemap));
    for (const pageUrl of locs.filter((loc) => !looksLikeSitemap(loc)).slice(0, MAX_SITEMAP_URLS)) {
      discoveredUrls.push({ url: pageUrl, source: result.url });
    }
  }

  const secondBatch = prioritizeSitemaps([...childSitemaps, ...robotsSitemaps])
    .filter((url) => !fetchedSitemaps.includes(url))
    .slice(0, Math.max(0, MAX_SITEMAPS_TO_FETCH - fetchedSitemaps.length));
  const secondResults = await fetchSitemapBatch(secondBatch);

  for (const result of secondResults) {
    fetchedSitemaps.push(result.url);
    const locs = extractLocs(result.xml);
    for (const pageUrl of locs.filter((loc) => !looksLikeSitemap(loc)).slice(0, MAX_SITEMAP_URLS)) {
      discoveredUrls.push({ url: pageUrl, source: result.url });
    }
  }

  return summarizeSitemap(discoveredUrls, fetchedSitemaps);
}

async function collectNetworkEvidence(pageUrl) {
  const signals = [];
  const origin = originFromUrl(pageUrl);
  if (!origin) return {
    signals,
    sitemap: {
      checked: false,
      status: "missing",
      sitemapsChecked: [],
      totalUrlsFound: 0,
      contentUrlsFound: 0,
      hasBlog: false,
      blogSignals: [],
      examples: [],
      message: "URL invalida para verificar sitemap."
    }
  };

  const sitemapPromise = collectSitemapEvidence(origin);
  await Promise.allSettled([
    probeCurrentPage(signals, pageUrl),
    probeWordPress(signals, origin),
    probeCommonFiles(signals, origin)
  ]);

  const sitemap = await sitemapPromise.catch(() => ({
    checked: true,
    status: "error",
    sitemapsChecked: [],
    totalUrlsFound: 0,
    contentUrlsFound: 0,
    hasBlog: false,
    blogSignals: [],
    examples: [],
    message: "Falha ao verificar sitemap rapidamente."
  }));

  return { signals, sitemap };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "CMS_DETECT_COLLECT_NETWORK") {
    return false;
  }

  collectNetworkEvidence(message.url)
    .then((data) => {
      sendResponse({ ok: true, signals: data.signals, sitemap: data.sitemap });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Falha ao coletar evidencias de rede."
      });
    });

  return true;
});
