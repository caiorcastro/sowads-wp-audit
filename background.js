importScripts("detector.js");

const REQUEST_TIMEOUT_MS = 2400;
const MAX_SITEMAPS_TO_FETCH = 8;
const MAX_SITEMAP_URLS = 650;
const MAX_BLOG_EXAMPLES = 4;
const MAX_CONTENT_LINK_PROBES = 3;
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

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function baseDomain(hostname) {
  const parts = String(hostname || "").replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  if (last === "br" && ["com", "net", "org", "blog"].includes(second) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function sameSiteFamily(a, b) {
  const aBase = baseDomain(hostnameFromUrl(a));
  const bBase = baseDomain(hostnameFromUrl(b));
  return Boolean(aBase && bBase && aBase === bBase);
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

function inspectHeaders(signals, response, url, source = "headers", labelPrefix = "") {
  const headers = {};
  for (const [key, value] of response.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  const combined = lower(Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\n"));

  if (combined.includes("wp-json") || combined.includes("api.w.org")) {
    add(signals, "wordpress", `${labelPrefix}Headers WordPress REST`, "Link/header contém wp-json ou api.w.org", 45, source, url);
  }
  if (combined.includes("wordpress")) {
    add(signals, "wordpress", `${labelPrefix}Header WordPress`, "Header menciona WordPress", 35, source, url);
  }
  if (combined.includes("x-shopify") || combined.includes("shopify")) {
    add(signals, "shopify", `${labelPrefix}Headers Shopify`, "Header menciona Shopify", 42, source, url);
  }
  if (combined.includes("x-wix") || combined.includes("wix")) {
    add(signals, "wix", `${labelPrefix}Headers Wix`, "Header menciona Wix", 36, source, url);
  }
  if (combined.includes("x-drupal") || combined.includes("drupal")) {
    add(signals, "drupal", `${labelPrefix}Headers Drupal`, "Header menciona Drupal", 38, source, url);
  }
  if (combined.includes("x-generator") && combined.includes("joomla")) {
    add(signals, "joomla", `${labelPrefix}Headers Joomla`, "X-Generator Joomla", 42, source, url);
  }
  if (combined.includes("x-magento") || combined.includes("magento")) {
    add(signals, "magento", `${labelPrefix}Headers Magento`, "Header menciona Magento", 38, source, url);
  }
  if (combined.includes("squarespace")) {
    add(signals, "squarespace", `${labelPrefix}Headers Squarespace`, "Header menciona Squarespace", 38, source, url);
  }
  if (combined.includes("hubspot")) {
    add(signals, "hubspot", `${labelPrefix}Headers HubSpot`, "Header menciona HubSpot", 38, source, url);
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

async function probeWordPress(signals, origin, source = "network", labelPrefix = "") {
  await Promise.allSettled([
    probeWordPressJson(signals, origin, source, labelPrefix),
    probeWordPressEndpoint(signals, origin, "/wp-login.php", source, labelPrefix),
    probeWordPressEndpoint(signals, origin, "/xmlrpc.php", source, labelPrefix)
  ]);
}

async function probeWordPressJson(signals, origin, source = "network", labelPrefix = "") {
  const wpJsonUrl = `${origin}/wp-json/`;

  try {
    const response = await fetchWithTimeout(wpJsonUrl, {
      method: "GET",
      headers: {
        "accept": "application/json"
      }
    });

    inspectHeaders(signals, response, wpJsonUrl, source, labelPrefix);

    const contentType = lower(response.headers.get("content-type"));
    if (response.ok && contentType.includes("json")) {
      const data = await response.json();
      const payload = JSON.stringify(data).slice(0, 25000);
      if (payload.includes('"wp/v2"') || payload.includes('"namespaces"') && payload.includes("wp/")) {
        add(signals, "wordpress", `${labelPrefix}Endpoint /wp-json/`, "REST API WordPress respondeu JSON válido", 55, source, wpJsonUrl);
      }
    }
  } catch (_) {
    // Sites podem bloquear /wp-json/; a ausência de resposta não invalida outros sinais.
  }
}

async function probeWordPressEndpoint(signals, origin, path, source = "network", labelPrefix = "") {
  const url = `${origin}${path}`;

  try {
    const response = await fetchWithTimeout(url, { method: "HEAD" });
    const server = lower(response.headers.get("server"));
    if ([200, 301, 302, 405].includes(response.status)) {
      add(signals, "wordpress", `${labelPrefix}Endpoint ${path}`, `status ${response.status}${server ? `, server ${server}` : ""}`, 14, source, url);
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

function inspectHtmlSignals(signals, html, url, source, labelPrefix) {
  const body = lower(html || "");
  if (!body) return;

  if (body.includes("content=\"wordpress") || body.includes("/wp-content/") || body.includes("/wp-includes/")) {
    add(signals, "wordpress", `${labelPrefix}HTML WordPress`, "HTML contém generator/assets WordPress", 38, source, url);
  }
  if (body.includes("https://api.w.org/") || body.includes("/wp-json/")) {
    add(signals, "wordpress", `${labelPrefix}REST API WordPress no HTML`, "HTML menciona api.w.org ou /wp-json/", 42, source, url);
  }
  if (body.includes("wp-emoji-release") || body.includes("wp-block-library")) {
    add(signals, "wordpress", `${labelPrefix}Assets WordPress`, "HTML contém wp-emoji-release ou wp-block-library", 30, source, url);
  }
  if (body.includes("cdn.shopify.com") || body.includes("window.shopify")) {
    add(signals, "shopify", `${labelPrefix}HTML Shopify`, "HTML contém sinais Shopify", 34, source, url);
  }
  if (body.includes("wixstatic.com") || body.includes("parastorage.com")) {
    add(signals, "wix", `${labelPrefix}HTML Wix`, "HTML contém assets Wix", 34, source, url);
  }
  if (body.includes("data-wf-page") || body.includes("webflow.js")) {
    add(signals, "webflow", `${labelPrefix}HTML Webflow`, "HTML contém sinais Webflow", 34, source, url);
  }
  if (body.includes("squarespace_context") || body.includes("static1.squarespace.com")) {
    add(signals, "squarespace", `${labelPrefix}HTML Squarespace`, "HTML contém sinais Squarespace", 34, source, url);
  }
  if (body.includes("drupalsettings") || body.includes("/sites/default/")) {
    add(signals, "drupal", `${labelPrefix}HTML Drupal`, "HTML contém sinais Drupal", 34, source, url);
  }
  if (body.includes("requirejs-config.js") || body.includes("/static/frontend/")) {
    add(signals, "magento", `${labelPrefix}HTML Magento`, "HTML contém sinais Magento", 30, source, url);
  }
}

function selectContentLinks(pageUrl, contentLinks) {
  const seen = new Set();
  return (Array.isArray(contentLinks) ? contentLinks : [])
    .filter((link) => link && link.url && /^https?:\/\//i.test(link.url))
    .filter((link) => sameSiteFamily(pageUrl, link.url))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .filter((link) => {
      const key = originFromUrl(link.url) || link.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CONTENT_LINK_PROBES);
}

async function probeContentLink(signals, link) {
  const source = "blog/conteúdo";
  const labelPrefix = "Blog: ";
  const response = await fetchWithTimeout(link.url, {
    method: "GET",
    headers: {
      "accept": "text/html,application/xhtml+xml,*/*"
    }
  });

  inspectHeaders(signals, response, link.url, source, labelPrefix);
  const contentType = lower(response.headers.get("content-type"));
  if (response.ok && (!contentType || contentType.includes("html") || contentType.includes("text"))) {
    inspectHtmlSignals(signals, (await response.text()).slice(0, 260000), link.url, source, labelPrefix);
  }

  const linkedOrigin = originFromUrl(response.url || link.url);
  if (linkedOrigin) {
    await Promise.allSettled([
      probeWordPress(signals, linkedOrigin, source, labelPrefix),
      probeCommonFiles(signals, linkedOrigin)
    ]);
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
    contentUrls: uniqueContentUrls,
    hasBlog: uniqueContentUrls.length > 0,
    blogSignals: Array.from(blogSignals),
    examples,
    message: uniqueContentUrls.length
      ? `${uniqueContentUrls.length} URL(s) de conteúdo/artigo encontradas no sitemap.`
      : fetchedSitemaps.length
        ? "Sitemap encontrado, mas sem URLs claras de blog/artigos."
        : "Não encontrei sitemap público nos caminhos rápidos."
  };
}

function mergeSitemapEvidence(sitemaps, contentLinksChecked) {
  const valid = sitemaps.filter(Boolean);
  const fetched = unique(valid.flatMap((item) => item.sitemapsChecked || []));
  const contentUrls = unique(valid.flatMap((item) => item.contentUrls || item.examples || []));
  const examples = contentUrls.slice(0, MAX_BLOG_EXAMPLES);
  const hasLinkedContent = Array.isArray(contentLinksChecked) && contentLinksChecked.length > 0;

  return {
    checked: valid.some((item) => item.checked),
    status: fetched.length ? "found" : "missing",
    sitemapsChecked: fetched,
    totalUrlsFound: valid.reduce((total, item) => total + Number(item.totalUrlsFound || 0), 0),
    contentUrlsFound: contentUrls.length,
    contentUrls,
    hasBlog: contentUrls.length > 0,
    blogSignals: unique(valid.flatMap((item) => item.blogSignals || [])),
    examples,
    contentLinksChecked,
    message: contentUrls.length
      ? `${contentUrls.length} URL(s) de conteúdo/artigo encontradas${hasLinkedContent ? ", incluindo área de blog/conteúdo ligada na página." : " no sitemap."}`
      : fetched.length
        ? `Sitemap encontrado${hasLinkedContent ? " e área de blog/conteúdo verificada" : ""}, mas sem URLs claras de blog/artigos.`
        : hasLinkedContent
          ? "Área de blog/conteúdo encontrada na página, mas sem sitemap público claro."
          : "Não encontrei sitemap público nos caminhos rápidos."
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

async function collectNetworkEvidence(pageUrl, contentLinks = []) {
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
      contentLinksChecked: [],
      message: "URL inválida para verificar sitemap."
    }
  };

  const selectedContentLinks = selectContentLinks(pageUrl, contentLinks);
  const sitemapPromise = collectSitemapEvidence(origin);
  await Promise.allSettled([
    probeCurrentPage(signals, pageUrl),
    probeWordPress(signals, origin),
    probeCommonFiles(signals, origin),
    ...selectedContentLinks.map((link) => probeContentLink(signals, link))
  ]);

  const sitemaps = [await sitemapPromise.catch(() => ({
    checked: true,
    status: "error",
    sitemapsChecked: [],
    totalUrlsFound: 0,
    contentUrlsFound: 0,
    contentUrls: [],
    hasBlog: false,
    blogSignals: [],
    examples: [],
    message: "Falha ao verificar sitemap rapidamente."
  }))];

  const linkedSitemaps = await Promise.allSettled(
    selectedContentLinks
      .map((link) => originFromUrl(link.url))
      .filter((linkedOrigin) => linkedOrigin && linkedOrigin !== origin)
      .map((linkedOrigin) => collectSitemapEvidence(linkedOrigin))
  );

  for (const result of linkedSitemaps) {
    if (result.status === "fulfilled") sitemaps.push(result.value);
  }

  const sitemap = mergeSitemapEvidence(sitemaps, selectedContentLinks.map((link) => ({
    url: link.url,
    text: link.text || "Blog/conteúdo"
  })));

  return { signals, sitemap };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "CMS_DETECT_COLLECT_NETWORK") {
    return false;
  }

  collectNetworkEvidence(message.url, message.contentLinks || [])
    .then((data) => {
      sendResponse({ ok: true, signals: data.signals, sitemap: data.sitemap });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Falha ao coletar evidências de rede."
      });
    });

  return true;
});
