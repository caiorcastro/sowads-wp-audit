# Sowads WP Audit

![Sowads WP Audit hero](assets/readme-hero.svg)

<p align="center">
  <a href="https://github.com/caiorcastro/sowads-wp-audit">
    <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Manifest%20V3-0b5f56?style=flat-square">
  </a>
  <img alt="No build step" src="https://img.shields.io/badge/Build-none-18a58f?style=flat-square">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/Stack-Vanilla%20JS-f2b84b?style=flat-square">
  <img alt="Truth first" src="https://img.shields.io/badge/Policy-no%20guessing-111615?style=flat-square">
</p>

Extensao Chrome simples, rapida e visualmente alinhada ao look da Sowads para identificar o CMS provavel de um site, com foco especial em WordPress. Ela tambem faz uma leitura conservadora de sitemap para encontrar sinais reais de blog, artigos, noticias e conteudo.

O principio do projeto e direto: mostrar o que foi encontrado, deixar claro o nivel de confianca e nunca inventar volume de posts ou CMS.

## Highlights

- Detecta WordPress como prioridade, mas tambem reconhece Shopify, Wix, Webflow, Squarespace, Drupal, Joomla, Magento, Ghost, HubSpot CMS, PrestaShop, Blogger, Duda e sinais de Next.js.
- Usa evidencias reais: HTML, assets, DOM, cookies, headers, endpoints leves e sitemap publico.
- Mostra pontuacao e confianca para o CMS principal.
- Lista evidencias para auditoria rapida.
- Verifica sitemaps sem inflar o numero com paginas institucionais.
- Nao exige build, bundler, dependencias ou servidor local.

## Interface

A extensao foi desenhada para uma leitura em menos de 10 segundos:

1. CMS provavel no topo.
2. Pontuacao de confianca ao lado.
3. Contexto curto do CMS detectado.
4. Bloco de sitemap com contagem conservadora de conteudo.
5. Evidencias que explicam o resultado.

O visual usa uma linguagem corporativa moderna: verde profundo, teal, acento quente, cards limpos e hierarquia objetiva. A ideia e combinar com a narrativa da Sowads: estrategia, tecnologia, SEO, dados e operacao.

## Conteudo Via Sitemap

A extensao procura sitemaps publicos e classifica apenas URLs com sinal forte de conteudo.

Ela tenta:

- `Sitemap:` dentro de `robots.txt`;
- `/sitemap.xml`;
- `/sitemap_index.xml`;
- `/wp-sitemap.xml`;
- `/post-sitemap.xml`;
- `/article-sitemap.xml`;
- `/blog-sitemap.xml`;
- `/news-sitemap.xml`;
- alguns sitemaps filhos descobertos no sitemap principal.

Ela conta URLs quando:

- o sitemap filho parece ser de conteudo, como `post`, `article`, `blog`, `news`, `noticia`, `insight`, `conteudo`, `materia` ou `wp-sitemap-posts-post`;
- ou a URL tem caminho claro de conteudo, como `/blog/`, `/artigos/`, `/noticias/`, `/insights/`, `/conteudos/`;
- ou a URL usa padrao comum de post com data, como `/2025/04/nome-do-post`.

Ela ignora:

- paginas institucionais;
- produtos;
- categorias;
- tags;
- autores;
- anexos;
- carrinho;
- checkout;
- conta/login;
- politicas, termos, contato, sobre e servicos.

Importante: a contagem exibida nao e uma estimativa do banco de dados. Ela representa somente URLs classificadas como conteudo em sitemaps publicos durante a verificacao rapida.

## CMS Detectados

| CMS ou plataforma | Principais sinais usados |
| --- | --- |
| WordPress | `/wp-content/`, `/wp-includes/`, `/wp-json/`, `api.w.org`, `wp-login.php`, `xmlrpc.php`, classes `wp-*`, cookies `wordpress_*` |
| Shopify | `window.Shopify`, `cdn.shopify.com`, headers Shopify, cookies `_shopify*` |
| Wix | `wixstatic.com`, `parastorage.com`, `window.wixBiSession`, headers Wix |
| Webflow | `data-wf-page`, `data-wf-site`, `window.Webflow`, `webflow.js` |
| Squarespace | `SQUARESPACE_CONTEXT`, `static1.squarespace.com`, headers Squarespace |
| Drupal | `drupalSettings`, `/sites/default/`, `/core/misc/drupal` |
| Joomla | `/administrator/`, `/media/system/`, `/templates/`, generator Joomla |
| Magento | `/static/frontend/`, `requirejs-config.js`, headers Magento |
| Ghost | `/ghost/`, generator Ghost |
| HubSpot CMS | `HubSpotConversations`, `hbspt`, `hs-scripts.com`, headers HubSpot |
| PrestaShop | generator PrestaShop, scripts e modulos PrestaShop |
| Blogger | `blogger.com`, `blogspot.com`, generator Blogger |
| Duda | `duda.co`, `multiscreensite.com` |
| Next.js | `/_next/static/`, `__NEXT_DATA__` como sinal de framework, nao de CMS |

## Skills Necessarias

Este projeto junta algumas competencias para entregar uma extensao util sem virar uma ferramenta pesada.

| Skill | Por que importa |
| --- | --- |
| Chrome Extension Manifest V3 | Define permissoes, popup, service worker e content script do jeito aceito pelo Chrome moderno. |
| JavaScript Vanilla | Mantem a extensao leve, sem build e facil de auditar. |
| DOM Inspection | Coleta sinais reais da pagina carregada, como metas, assets, classes e objetos globais. |
| Network Probing | Consulta headers e endpoints publicos com timeout curto, sem travar a experiencia. |
| WordPress Detection | Prioriza sinais fortes de WordPress e evita concluir com base em uma unica pista fraca. |
| CMS Fingerprinting | Reconhece padroes de Shopify, Wix, Webflow, Drupal, Joomla e outras plataformas. |
| SEO Technical Audit | Usa sitemap e `robots.txt` para entender se existe conteudo indexavel. |
| UX Writing | Explica incerteza, confianca e ausencia de evidencia sem exagero. |
| UI Design | Entrega uma interface visualmente forte, mas simples para decisao rapida. |
| Performance Thinking | Limita requisicoes, URLs e sitemaps para manter tudo rapido. |
| GitHub Repository Design | README com hero, badges, instalacao, criterios, estrutura e roadmap. |

## Manual De Instalacao

### Instalar Como Extensao Local

1. Baixe ou clone este repositorio.
2. Abra o Chrome.
3. Acesse `chrome://extensions/`.
4. Ative `Modo do desenvolvedor`.
5. Clique em `Carregar sem compactacao`.
6. Selecione a pasta do projeto.
7. Abra um site HTTP ou HTTPS.
8. Clique no icone da extensao.

### Clonar Pelo Terminal

```bash
git clone https://github.com/caiorcastro/sowads-wp-audit.git
cd sowads-wp-audit
```

Depois carregue a pasta em `chrome://extensions/` usando `Carregar sem compactacao`.

### Atualizar Depois De Mudancas

1. Abra `chrome://extensions/`.
2. Encontre `Sowads WP Audit`.
3. Clique no botao de recarregar da extensao.
4. Reabra ou atualize a aba que deseja auditar.

## Estrutura

```text
.
|-- assets/
|   `-- readme-hero.svg
|-- background.js
|-- content.js
|-- detector.js
|-- manifest.json
|-- popup.css
|-- popup.html
|-- popup.js
`-- README.md
```

## Como Funciona

O popup pede duas coletas:

1. `content.js` coleta sinais da pagina atual.
2. `background.js` coleta sinais de rede e sitemap.
3. `detector.js` combina as evidencias, calcula pontuacao e gera o resumo.
4. `popup.js` renderiza CMS principal, alternativas, sitemap e evidencias.

O resultado e uma pontuacao acumulada por CMS. Sinais fortes aumentam a confianca, sinais fracos aparecem como possibilidade e ausencia de sinal nao vira conclusao.

## Politica De Verdade

A extensao deve ser conservadora.

- Se nao encontrar CMS, mostra que nao identificou.
- Se encontrar poucos sinais, marca como possivel.
- Se encontrar sitemap sem URLs claras de conteudo, nao conta como blog.
- Se o site bloqueia endpoints, a extensao nao assume que o CMS nao existe.
- Se um site usa headless CMS ou CDN agressiva, o resultado pode ser inconclusivo.

## Testes Rapidos

Validacoes feitas no projeto:

```bash
node --check detector.js
node --check content.js
node --check background.js
node --check popup.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

Tambem foram simulados sitemaps para garantir que:

- sitemap geral com `/servicos` e `/contato` nao infla contagem;
- URLs em `/blog/` e `/noticias/` entram como conteudo;
- `wp-sitemap-posts-post` conta posts mesmo sem `/blog/` no slug;
- `wp-sitemap-posts-page` nao conta paginas como artigos.

## Roadmap

- Mostrar versao detectada quando houver evidencia segura.
- Exportar resultado da auditoria em JSON.
- Criar modo "copiar resumo" para CRM ou planilha.
- Adicionar testes automatizados para o classificador de sitemap.
- Adicionar icones oficiais da extensao em varios tamanhos.
- Publicar como release instalavel.

## Licenca

Projeto interno/experimental da Sowads. Defina uma licenca antes de distribuir publicamente.
