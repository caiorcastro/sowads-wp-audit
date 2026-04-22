(function attachDetector(global) {
  const CMS_META = {
    wordpress: {
      name: "WordPress",
      description: "CMS PHP popular em blogs, sites institucionais e e-commerce com WooCommerce."
    },
    shopify: {
      name: "Shopify",
      description: "Plataforma SaaS de e-commerce."
    },
    wix: {
      name: "Wix",
      description: "Construtor visual de sites hospedado."
    },
    webflow: {
      name: "Webflow",
      description: "Construtor visual com hospedagem e CMS próprio."
    },
    squarespace: {
      name: "Squarespace",
      description: "Construtor de sites hospedado."
    },
    drupal: {
      name: "Drupal",
      description: "CMS PHP modular usado em sites corporativos e governamentais."
    },
    joomla: {
      name: "Joomla",
      description: "CMS PHP com templates, módulos e componentes."
    },
    magento: {
      name: "Magento / Adobe Commerce",
      description: "Plataforma PHP de e-commerce."
    },
    ghost: {
      name: "Ghost",
      description: "CMS focado em publicação e newsletters."
    },
    hubspot: {
      name: "HubSpot CMS",
      description: "CMS e plataforma de marketing da HubSpot."
    },
    prestashop: {
      name: "PrestaShop",
      description: "Plataforma open source de e-commerce."
    },
    blogger: {
      name: "Blogger",
      description: "Plataforma de blogs do Google."
    },
    duda: {
      name: "Duda",
      description: "Construtor de sites usado por agências e white label."
    },
    nextjs: {
      name: "Next.js",
      description: "Framework React. Pode indicar site customizado, não necessariamente CMS."
    }
  };

  const CMS_ORDER = [
    "wordpress",
    "shopify",
    "wix",
    "webflow",
    "squarespace",
    "drupal",
    "joomla",
    "magento",
    "ghost",
    "hubspot",
    "prestashop",
    "blogger",
    "duda",
    "nextjs"
  ];

  function normalizeSignal(signal) {
    return {
      cms: signal.cms,
      label: signal.label || "Evidência",
      detail: signal.detail || "",
      source: signal.source || "page",
      url: signal.url || "",
      weight: Number(signal.weight || 0)
    };
  }

  function scoreSignals(signals) {
    const scores = {};
    const byCms = {};

    for (const signal of signals.map(normalizeSignal)) {
      if (!signal.cms || !CMS_META[signal.cms] || !signal.weight) {
        continue;
      }

      scores[signal.cms] = (scores[signal.cms] || 0) + signal.weight;
      byCms[signal.cms] = byCms[signal.cms] || [];
      byCms[signal.cms].push(signal);
    }

    return Object.entries(scores)
      .map(([cms, score]) => {
        const cappedScore = Math.min(100, Math.round(score));
        return {
          cms,
          name: CMS_META[cms].name,
          description: CMS_META[cms].description,
          score: cappedScore,
          confidence: confidenceFromScore(cappedScore),
          signals: (byCms[cms] || []).sort((a, b) => b.weight - a.weight)
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return CMS_ORDER.indexOf(a.cms) - CMS_ORDER.indexOf(b.cms);
      });
  }

  function confidenceFromScore(score) {
    if (score >= 75) return "alta";
    if (score >= 45) return "média";
    if (score >= 20) return "baixa";
    return "incerta";
  }

  function signalWeightTotal(signals, predicate) {
    return signals
      .filter(predicate)
      .reduce((total, signal) => total + Number(signal.weight || 0), 0);
  }

  function isContentHubSignal(signal) {
    const source = String(signal.source || "").toLowerCase();
    const label = String(signal.label || "").toLowerCase();
    return source.includes("blog") || source.includes("conteúdo") || label.startsWith("blog:");
  }

  function summarize(results) {
    const primary = results[0] || null;
    const alternatives = results.slice(1, 4);

    if (!primary || primary.score < 20) {
      return {
        status: "unknown",
        title: "CMS não identificado",
        message: "Não encontrei sinais fortes de WordPress ou outro CMS conhecido.",
        primary: null,
        alternatives
      };
    }

    const contentHubScore = signalWeightTotal(primary.signals, isContentHubSignal);
    const directScore = signalWeightTotal(primary.signals, (signal) => !isContentHubSignal(signal));
    const detectedInContentHub = contentHubScore >= 45 && contentHubScore > directScore;

    return {
      status: primary.confidence === "baixa" ? "possible" : "detected",
      title: detectedInContentHub
        ? `${primary.name} detectado no blog`
        : primary.confidence === "baixa"
          ? `${primary.name} possível`
          : `${primary.name} detectado`,
      message: detectedInContentHub
        ? `A página apontou para uma área de conteúdo com sinais de ${primary.name}. Confiança ${primary.confidence}, baseada em ${primary.signals.length} evidência(s).`
        : `Confiança ${primary.confidence}, baseada em ${primary.signals.length} evidência(s).`,
      primary,
      alternatives
    };
  }

  function mergeEvidence(...groups) {
    const merged = [];
    const seen = new Set();

    for (const group of groups) {
      for (const signal of Array.isArray(group) ? group : []) {
        const normalized = normalizeSignal(signal);
        const key = [
          normalized.cms,
          normalized.label,
          normalized.detail,
          normalized.source,
          normalized.url
        ].join("|");

        if (!seen.has(key)) {
          seen.add(key);
          merged.push(normalized);
        }
      }
    }

    return merged;
  }

  function analyzeSignals(signals) {
    const results = scoreSignals(signals);
    return {
      results,
      summary: summarize(results)
    };
  }

  global.CMSDetector = {
    CMS_META,
    analyzeSignals,
    mergeEvidence,
    scoreSignals
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
