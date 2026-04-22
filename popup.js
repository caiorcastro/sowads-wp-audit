const loadingState = document.querySelector("#loadingState");
const resultState = document.querySelector("#resultState");
const errorState = document.querySelector("#errorState");
const errorMessage = document.querySelector("#errorMessage");
const pageHost = document.querySelector("#pageHost");
const statusLabel = document.querySelector("#statusLabel");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const scoreBadge = document.querySelector("#scoreBadge");
const primaryDescription = document.querySelector("#primaryDescription");
const contentTitle = document.querySelector("#contentTitle");
const contentCount = document.querySelector("#contentCount");
const contentMessage = document.querySelector("#contentMessage");
const contentExamples = document.querySelector("#contentExamples");
const contentHubsBlock = document.querySelector("#contentHubsBlock");
const contentHubsList = document.querySelector("#contentHubsList");
const alternativesBlock = document.querySelector("#alternativesBlock");
const alternativesList = document.querySelector("#alternativesList");
const signalsList = document.querySelector("#signalsList");
const refreshButton = document.querySelector("#refreshButton");

function setVisible(element, visible) {
  element.classList.toggle("hidden", !visible);
}

function showLoading() {
  setVisible(loadingState, true);
  setVisible(resultState, false);
  setVisible(errorState, false);
}

function showError(message) {
  errorMessage.textContent = message;
  setVisible(loadingState, false);
  setVisible(resultState, false);
  setVisible(errorState, true);
}

function formatHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "Página atual";
  }
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function renderSignals(primary, allResults) {
  signalsList.innerHTML = "";

  const signals = primary
    ? primary.signals
    : allResults.flatMap((result) => result.signals).sort((a, b) => b.weight - a.weight);

  if (!signals.length) {
    const empty = document.createElement("div");
    empty.className = "signal";
    empty.textContent = "Nenhuma evidência conhecida encontrada nesta página.";
    signalsList.appendChild(empty);
    return;
  }

  for (const signal of signals.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = "signal";

    const head = document.createElement("div");
    head.className = "signal-head";

    const title = document.createElement("div");
    title.className = "signal-title";
    title.textContent = signal.label;

    const score = document.createElement("div");
    score.className = "signal-score";
    score.textContent = `+${signal.weight}`;

    const detail = document.createElement("p");
    detail.className = "signal-detail";
    detail.textContent = [signal.detail, signal.source].filter(Boolean).join(" | ");

    head.append(title, score);
    item.append(head, detail);
    signalsList.appendChild(item);
  }
}

function renderAlternatives(alternatives) {
  alternativesList.innerHTML = "";

  const visibleAlternatives = alternatives.filter((item) => item.score >= 20);
  setVisible(alternativesBlock, visibleAlternatives.length > 0);

  for (const item of visibleAlternatives) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${item.name} ${item.score}`;
    alternativesList.appendChild(pill);
  }
}

function simplifyUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`;
  } catch (_) {
    return url;
  }
}

function renderSitemap(sitemap) {
  const data = sitemap || {
    checked: false,
    status: "missing",
    totalUrlsFound: 0,
    contentUrlsFound: 0,
    hasBlog: false,
    examples: [],
    message: "Sitemap não verificado."
  };

  contentExamples.innerHTML = "";
  contentCount.textContent = String(data.contentUrlsFound || 0);

  if (data.hasBlog) {
    contentTitle.textContent = "Blog/conteúdo encontrado";
  } else if (data.status === "found") {
    contentTitle.textContent = "Sem blog claro";
  } else {
    contentTitle.textContent = "Sitemap não encontrado";
  }

  contentMessage.textContent = data.message || "Sem evidência de blog no sitemap.";

  const examples = Array.isArray(data.examples) ? data.examples.slice(0, 4) : [];
  setVisible(contentExamples, examples.length > 0);

  for (const url of examples) {
    const item = document.createElement("a");
    item.className = "url-item";
    item.href = url;
    item.target = "_blank";
    item.rel = "noreferrer";
    item.title = url;
    item.textContent = simplifyUrl(url);
    contentExamples.appendChild(item);
  }

  renderContentHubs(data.contentLinksChecked || []);
}

function renderContentHubs(links) {
  contentHubsList.innerHTML = "";
  const visibleLinks = Array.isArray(links) ? links.slice(0, 4) : [];
  setVisible(contentHubsBlock, visibleLinks.length > 0);

  for (const link of visibleLinks) {
    const item = document.createElement("a");
    item.className = "hub-item";
    item.href = link.url;
    item.target = "_blank";
    item.rel = "noreferrer";
    item.title = link.url;

    const label = document.createElement("span");
    label.className = "hub-url";
    label.textContent = simplifyUrl(link.url);

    const meta = document.createElement("span");
    meta.className = "hub-meta";
    const cms = Array.isArray(link.cms) && link.cms.length ? link.cms[0] : null;
    meta.textContent = cms ? `${cms.name} ${cms.score}` : "CMS não confirmado";

    item.append(label, meta);
    contentHubsList.appendChild(item);
  }
}

function renderResult(analysis, sitemap) {
  const { summary, results } = analysis;
  const primary = summary.primary;

  resultState.classList.toggle("low", primary && primary.score < 45);
  resultState.classList.toggle("unknown", !primary);

  statusLabel.textContent = primary ? `Confiança ${primary.confidence}` : "Sem match";
  resultTitle.textContent = summary.title;
  resultMessage.textContent = summary.message;
  scoreBadge.textContent = primary ? primary.score : "0";

  if (primary && primary.description) {
    primaryDescription.textContent = primary.description;
    setVisible(primaryDescription, true);
  } else {
    setVisible(primaryDescription, false);
  }

  renderSitemap(sitemap);
  renderAlternatives(summary.alternatives);
  renderSignals(primary, results);

  setVisible(loadingState, false);
  setVisible(errorState, false);
  setVisible(resultState, true);
}

async function detect() {
  showLoading();

  const tab = await getActiveTab();
  if (!tab || !tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    pageHost.textContent = "Página indisponível";
    showError("Abra um site HTTP ou HTTPS para analisar.");
    return;
  }

  pageHost.textContent = formatHost(tab.url);

  let pageSignals = [];
  let contentLinks = [];
  try {
    const pageResponse = await sendTabMessage(tab.id, { type: "CMS_DETECT_COLLECT_PAGE" });
    if (pageResponse && pageResponse.ok && pageResponse.data) {
      pageSignals = pageResponse.data.signals || [];
      contentLinks = pageResponse.data.contentLinks || [];
    }
  } catch (_) {
    pageSignals = [];
  }

  let networkSignals = [];
  let sitemap = null;
  try {
    const networkResponse = await sendMessage({
      type: "CMS_DETECT_COLLECT_NETWORK",
      url: tab.url,
      contentLinks
    });
    if (networkResponse && networkResponse.ok) {
      networkSignals = networkResponse.signals || [];
      sitemap = networkResponse.sitemap || null;
    }
  } catch (_) {
    networkSignals = [];
  }

  const signals = CMSDetector.mergeEvidence(pageSignals, networkSignals);
  renderResult(CMSDetector.analyzeSignals(signals), sitemap);
}

refreshButton.addEventListener("click", detect);
document.addEventListener("DOMContentLoaded", detect);
