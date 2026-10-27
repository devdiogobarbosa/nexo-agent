export function wantsAnalyst(text: string, action?: string) {
  if (action === "transfer") return true;
  if (/\bn[aã]o\b/i.test(text) && /analista/i.test(text)) return false;
  return /(?:falar com|chame|chamar|transfere para|transferir para).{0,40}analista/i.test(text);
}
