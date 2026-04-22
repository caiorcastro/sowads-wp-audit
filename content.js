(function initContentDetector() {
  const MAX_ASSETS = 220;
  const MAX_CONTENT_LINKS = 8;

  function add(signals, cms, label, detail, weight, source, url) {
    signals.push({ cms, label, detail, weight, source, url });
  }

  function text(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function searchable(value) {
    return lower(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function currentOrigin() {
    try {
      return window.location.origin;
    } catch (_) {
      return "";
    }
  }

  function isOwnOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === currentOrigin();
    } catch (_) {
      return false;
    }
  }

  function contentLinkScore(anchor, absoluteUrl) {
    let url;
    try {
      url = new URL(absoluteUrl);
    } catch (_) {
      return 0;
    }

    const label = searchable([
      anchor.innerText,
      anchor.getAttribute("aria-label"),
      anchor.getAttribute("title"),
      anchor.getAttribute("href")
    ].filter(Boolean).join(" "));
    const path = searchable(`${url.hostname}${url.pathname}`);
    const value = `${label} ${path}`;
    const positive = [
      "blog",
      "noticia",
      "noticias",
      "artigo",
      "artigos",
      "insight",
      "insights",
      "conteudo",
      "conteudos",
      "receita",
      "receitas",
      "dica",
      "dicas",
      "guia",
      "guias",
      "revista",
      "imprensa",
      "novidade",
      "novidades",
      "inspiracao"
    ];
    const negative = [
      "produto",
      "produtos",
      "carrinho",
      "checkout",
      "conta",
      "login",
      "favoritos",
      "politica",
      "termos",
      "atendimento",
      "sacola"
    ];

    if (negative.some((word) => value.includes(word))) {
      return 0;
    }

    let score = 0;
    for (const word of positive) {
      if (value.includes(word)) score += 15;
    }
    if (url.hostname.startsWith("blog.")) score += 35;
    if (/\/(blog|noticias|artigos|insights|conteudos|receitas|dicas)(\/|$)/i.test(url.pathname)) {
      score += 30;
    }
    if (/^(blog|conteudo|conteudos|news)\./i.test(url.hostname)) {
      score += 25;
    }

    return Math.min(100, score);
  }

  function collectContentLinks() {
    const links = [];
    const seen = new Set();

    for (const anchor of Array.from(document.querySelectorAll("a[href]")).slice(0, 450)) {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || /^(#|mailto:|tel:|javascript:)/i.test(rawHref)) continue;

      let absoluteUrl = "";
      try {
        absoluteUrl = new URL(rawHref, window.location.href).href;
      } catch (_) {
        continue;
      }

      if (!/^https?:\/\//i.test(absoluteUrl) || absoluteUrl === window.location.href) continue;

      const score = contentLinkScore(anchor, absoluteUrl);
      if (score < 20 || seen.has(absoluteUrl)) continue;

      seen.add(absoluteUrl);
      links.push({
        url: absoluteUrl,
        text: text(anchor.innerText || anchor.getAttribute("aria-label") || anchor.getAttribute("title") || rawHref).slice(0, 90),
        score
      });
    }

    return links
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CONTENT_LINKS);
  }

  function collectMeta(signals) {
    const metas = Array.from(document.querySelectorAll("meta")).slice(0, 120);

    for (const meta of metas) {
      const name = lower(meta.getAttribute("name") || meta.getAttribute("property"));
      const content = lower(meta.getAttribute("content"));

      if (!content) continue;

      if (name === "generator" || content.includes("wordpress")) {
        if (content.includes("wordpress")) add(signals, "wordpress", "Meta generator", content, 45, "html");
        if (content.includes("shopify")) add(signals, "shopify", "Meta generator", content, 45, "html");
        if (content.includes("wix")) add(signals, "wix", "Meta generator", content, 45, "html");
        if (content.includes("webflow")) add(signals, "webflow", "Meta generator", content, 45, "html");
        if (content.includes("squarespace")) add(signals, "squarespace", "Meta generator", content, 45, "html");
        if (content.includes("drupal")) add(signals, "drupal", "Meta generator", content, 45, "html");
        if (content.includes("joomla")) add(signals, "joomla", "Meta generator", content, 45, "html");
        if (content.includes("magento")) add(signals, "magento", "Meta generator", content, 45, "html");
        if (content.includes("ghost")) add(signals, "ghost", "Meta generator", content, 45, "html");
        if (content.includes("prestashop")) add(signals, "prestashop", "Meta generator", content, 45, "html");
        if (content.includes("blogger")) add(signals, "blogger", "Meta generator", content, 45, "html");
      }

      if (name === "generator" && content.includes("hubspot")) {
        add(signals, "hubspot", "Meta generator", content, 45, "html");
      }
    }
  }

  function collectAssetSignals(signals) {
    const nodes = Array.from(document.querySelectorAll("script[src], link[href], img[src], source[src]"))
      .slice(0, MAX_ASSETS);

    for (const node of nodes) {
      const rawUrl = node.getAttribute("src") || node.getAttribute("href");
      const absoluteUrl = rawUrl ? new URL(rawUrl, window.location.href).href : "";
      const value = lower(absoluteUrl || rawUrl);
      if (!value) continue;

      if (value.includes("/wp-content/")) add(signals, "wordpress", "Asset wp-content", rawUrl, 28, "asset", absoluteUrl);
      if (value.includes("/wp-includes/")) add(signals, "wordpress", "Asset wp-includes", rawUrl, 25, "asset", absoluteUrl);
      if (value.includes("wp-emoji-release") || value.includes("wp-block-library")) {
        add(signals, "wordpress", "Script/estilo WordPress", rawUrl, 30, "asset", absoluteUrl);
      }
      if (value.includes("/wp-content/plugins/")) add(signals, "wordpress", "Plugin WordPress", rawUrl, 20, "asset", absoluteUrl);
      if (value.includes("/wp-content/themes/")) add(signals, "wordpress", "Tema WordPress", rawUrl, 18, "asset", absoluteUrl);

      if (value.includes("cdn.shopify.com") || value.includes("shopifycdn.net") || value.includes("/s/files/")) {
        add(signals, "shopify", "Asset Shopify", rawUrl, 30, "asset", absoluteUrl);
      }
      if (value.includes("wixstatic.com") || value.includes("parastorage.com") || value.includes("wix-code")) {
        add(signals, "wix", "Asset Wix", rawUrl, 32, "asset", absoluteUrl);
      }
      if (value.includes("webflow.js") || value.includes("assets.website-files.com") || value.includes("uploads-ssl.webflow.com")) {
        add(signals, "webflow", "Asset Webflow", rawUrl, 32, "asset", absoluteUrl);
      }
      if (value.includes("static1.squarespace.com") || value.includes("squarespace-cdn.com")) {
        add(signals, "squarespace", "Asset Squarespace", rawUrl, 32, "asset", absoluteUrl);
      }
      if (value.includes("/sites/default/") || value.includes("/core/misc/drupal") || value.includes("/misc/drupal")) {
        add(signals, "drupal", "Asset Drupal", rawUrl, 28, "asset", absoluteUrl);
      }
      if (value.includes("/media/system/") || value.includes("/templates/") && isOwnOrigin(absoluteUrl)) {
        add(signals, "joomla", "Asset Joomla", rawUrl, 22, "asset", absoluteUrl);
      }
      if (value.includes("/static/frontend/") || value.includes("mage/") || value.includes("requirejs-config.js")) {
        add(signals, "magento", "Asset Magento", rawUrl, 28, "asset", absoluteUrl);
      }
      if (value.includes("/ghost/") || value.includes("ghost.org")) {
        add(signals, "ghost", "Asset Ghost", rawUrl, 25, "asset", absoluteUrl);
      }
      if (value.includes("hs-scripts.com") || value.includes("hsforms.net") || value.includes("hubspot.com")) {
        add(signals, "hubspot", "Asset HubSpot", rawUrl, 28, "asset", absoluteUrl);
      }
      if (value.includes("/modules/") && value.includes("prestashop")) {
        add(signals, "prestashop", "Asset PrestaShop", rawUrl, 28, "asset", absoluteUrl);
      }
      if (value.includes("blogger.com") || value.includes("blogspot.com")) {
        add(signals, "blogger", "Asset Blogger", rawUrl, 26, "asset", absoluteUrl);
      }
      if (value.includes("duda.co") || value.includes("multiscreensite.com")) {
        add(signals, "duda", "Asset Duda", rawUrl, 26, "asset", absoluteUrl);
      }
      if (value.includes("/_next/static/")) {
        add(signals, "nextjs", "Asset Next.js", rawUrl, 18, "asset", absoluteUrl);
      }
    }
  }

  function collectDomSignals(signals) {
    const html = document.documentElement;
    const body = document.body;
    const classes = lower(`${html.className || ""} ${body ? body.className : ""}`);
    const ids = new Set(Array.from(document.querySelectorAll("[id]")).slice(0, 400).map((node) => lower(node.id)));

    if (classes.includes("wp-") || ids.has("wpadminbar")) {
      add(signals, "wordpress", "Classes/IDs WordPress", "classes ou ids com prefixo wp-", 24, "dom");
    }
    if (document.querySelector("link[rel='https://api.w.org/'], link[href*='/wp-json/']")) {
      add(signals, "wordpress", "REST API WordPress no HTML", "link rel api.w.org ou /wp-json/", 42, "html");
    }
    if (document.querySelector("form[action*='wp-login.php'], a[href*='wp-login.php'], a[href*='wp-admin']")) {
      add(signals, "wordpress", "Links de login/admin WordPress", "wp-login.php ou wp-admin", 24, "html");
    }

    if (classes.includes("wix") || window.wixBiSession) {
      add(signals, "wix", "Objeto/classe Wix", "wixBiSession ou classes Wix", 25, "dom");
    }
    if (document.querySelector("[data-wf-page], [data-wf-site]")) {
      add(signals, "webflow", "Atributos Webflow", "data-wf-page/data-wf-site", 42, "dom");
    }
    if (typeof window.Webflow !== "undefined") {
      add(signals, "webflow", "Objeto Webflow", "window.Webflow", 35, "dom");
    }
    if (typeof window.Static !== "undefined" && window.Static.SQUARESPACE_CONTEXT) {
      add(signals, "squarespace", "Contexto Squarespace", "Static.SQUARESPACE_CONTEXT", 42, "dom");
    }
    if (typeof window.drupalSettings !== "undefined" || classes.includes("drupal")) {
      add(signals, "drupal", "Objeto/classe Drupal", "drupalSettings ou classes Drupal", 35, "dom");
    }
    if (typeof window.Shopify !== "undefined") {
      add(signals, "shopify", "Objeto Shopify", "window.Shopify", 38, "dom");
    }
    if (typeof window.theme !== "undefined" && /shopify/i.test(JSON.stringify(window.theme).slice(0, 2000))) {
      add(signals, "shopify", "Tema Shopify", "window.theme contém Shopify", 20, "dom");
    }
    if (typeof window.HubSpotConversations !== "undefined" || typeof window.hbspt !== "undefined") {
      add(signals, "hubspot", "Objeto HubSpot", "HubSpotConversations/hbspt", 36, "dom");
    }
    if (typeof window.__NEXT_DATA__ !== "undefined" || document.querySelector("#__NEXT_DATA__")) {
      add(signals, "nextjs", "Marcador Next.js", "__NEXT_DATA__", 24, "dom");
    }
  }

  function collectCookieSignals(signals) {
    const cookies = lower(document.cookie);
    if (!cookies) return;

    if (cookies.includes("wordpress_") || cookies.includes("wp-settings")) {
      add(signals, "wordpress", "Cookies WordPress", "wordpress_* ou wp-settings", 22, "cookie");
    }
    if (cookies.includes("_shopify") || cookies.includes("cart_sig")) {
      add(signals, "shopify", "Cookies Shopify", "_shopify* ou cart_sig", 20, "cookie");
    }
    if (cookies.includes("wixsession")) {
      add(signals, "wix", "Cookies Wix", "wixSession", 20, "cookie");
    }
  }

  function collectInlineScriptSignals(signals) {
    const scripts = Array.from(document.scripts).slice(0, 80);
    for (const script of scripts) {
      const sample = lower(script.textContent).slice(0, 3000);
      if (!sample) continue;

      if (sample.includes("wp-json") || sample.includes("wp_localize_script")) {
        add(signals, "wordpress", "Script inline WordPress", "wp-json ou wp_localize_script", 22, "script");
      }
      if (sample.includes("squarespace_context")) {
        add(signals, "squarespace", "Script inline Squarespace", "SQUARESPACE_CONTEXT", 26, "script");
      }
      if (sample.includes("drupalsettings")) {
        add(signals, "drupal", "Script inline Drupal", "drupalSettings", 26, "script");
      }
      if (sample.includes("shopify.routes") || sample.includes("shopify.theme")) {
        add(signals, "shopify", "Script inline Shopify", "Shopify.routes/theme", 26, "script");
      }
      if (sample.includes("prestashop")) {
        add(signals, "prestashop", "Script inline PrestaShop", "prestashop", 24, "script");
      }
    }
  }

  function collectPageEvidence() {
    const signals = [];
    collectMeta(signals);
    collectAssetSignals(signals);
    collectDomSignals(signals);
    collectCookieSignals(signals);
    collectInlineScriptSignals(signals);
    return {
      url: window.location.href,
      title: document.title,
      signals,
      contentLinks: collectContentLinks()
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "CMS_DETECT_COLLECT_PAGE") {
      return false;
    }

    try {
      sendResponse({
        ok: true,
        data: collectPageEvidence()
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Falha ao coletar evidências da página."
      });
    }

    return true;
  });
})();
