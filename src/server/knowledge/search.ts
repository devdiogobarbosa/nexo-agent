import type { Article } from "@/lib/domain";

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function tokens(value: string) {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export type ArticleMatch = Article & { score: number };

export function searchArticles(articles: Article[], query: string, windowsVersion?: string | null) {
  const queryTokens = new Set(tokens(query));
  if (queryTokens.size === 0) return [];

  return articles
    .map((article) => {
      const haystack = tokens(`${article.title} ${article.body} ${article.tags.join(" ")}`);
      const score = haystack.filter((token) => queryTokens.has(token)).length;
      return { ...article, score };
    })
    .filter((article) => article.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((article) => {
      if (article.windowsVersion && windowsVersion && article.windowsVersion !== windowsVersion) {
        return {
          ...article,
          body: `${article.body} Este artigo vale apenas para Windows ${article.windowsVersion}; o equipamento informado é Windows ${windowsVersion}, então a orientação é abrir um chamado.`,
        };
      }
      return article;
    });
}
