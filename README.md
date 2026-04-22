# CMS Detector

Extensao Chrome Manifest V3 para identificar se a pagina atual parece usar WordPress ou outro CMS/plataforma.

## O que detecta

- WordPress
- Shopify
- Wix
- Webflow
- Squarespace
- Drupal
- Joomla
- Magento / Adobe Commerce
- Ghost
- HubSpot CMS
- PrestaShop
- Blogger
- Duda
- Next.js como indicio de site customizado, nao CMS

Tambem faz uma verificacao simples de sitemap para procurar sinais de blog, artigos, noticias ou conteudo. A contagem e conservadora: so considera URLs vindas de sitemaps com nome de conteudo (`post`, `article`, `blog`, `news`, `noticia`, `insight`) ou URLs com caminhos claros como `/blog/`, `/artigos/`, `/noticias/` ou data no formato de post. Quando encontrar, mostra:

- quantidade de URLs de conteudo/artigo encontradas no sitemap;
- alguns exemplos de URL;
- mensagem clara quando nao encontrar sitemap publico ou nao encontrar URLs claras de blog.

## Como instalar no Chrome

1. Abra `chrome://extensions/`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactacao`.
4. Selecione esta pasta: `/Users/caio.castro/Downloads/Sowads-WP-Audit`.
5. Abra um site e clique no icone da extensao.

## Como funciona

A extensao combina evidencias da pagina e da rede:

- HTML: `meta generator`, links, forms e atributos conhecidos.
- Assets: caminhos como `/wp-content/`, `/wp-includes/`, `cdn.shopify.com`, `wixstatic.com`, `webflow.js`.
- DOM: objetos globais como `window.Shopify`, `window.Webflow`, `drupalSettings`.
- Cookies: nomes associados a algumas plataformas.
- Headers e endpoints leves: headers da pagina, `/wp-json/`, `/robots.txt`, `/wp-login.php` e `/xmlrpc.php`.
- Sitemap rapido: `Sitemap:` no `robots.txt`, `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`, sitemaps de conteudo como `/post-sitemap.xml`, `/article-sitemap.xml`, `/blog-sitemap.xml`, `/news-sitemap.xml` e alguns sitemaps filhos.

O resultado e uma pontuacao. Sinais fortes aumentam a confianca; sinais fracos aparecem como "possivel".

## Observacoes

- Alguns sites escondem ou removem marcas do CMS, entao o resultado pode ser inconclusivo.
- Sites com cache, CDN ou headless WordPress podem mostrar poucos sinais.
- A extensao faz requisicoes leves apenas para o dominio da pagina aberta.
- O numero de posts/conteudos nao e estimado nem inventado: ele representa somente URLs classificadas como conteudo em sitemaps publicos durante a verificacao rapida.
- Sitemaps de paginas, produtos, categorias, tags, autores e anexos sao ignorados para nao inflar a contagem com URLs irrelevantes.
