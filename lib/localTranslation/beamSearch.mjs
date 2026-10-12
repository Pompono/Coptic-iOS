// Independent beam search: Transformers.js 3.8's generation loop only expands
// one candidate even when num_beams > 1. Keep a decoder cache per hypothesis.
export async function beamSearch(step, { startToken, eosToken, padToken, width = 4, maxTokens = 96, lengthPenalty = 1 }) {
  let live = [{ tokens: [startToken], score: 0, state: null }];
  const completed = [];
  const rank = beam => beam.score / Math.pow(Math.max(1, beam.tokens.length - 1), lengthPenalty);
  for (let position = 0; position < maxTokens && live.length; position++) {
    const candidates = [];
    for (const beam of live) {
      const { logits, state } = await step(beam.tokens, beam.state);
      let maximum = -Infinity;
      for (let i = 0; i < logits.length; i++) if (i !== padToken && Number.isFinite(logits[i])) maximum = Math.max(maximum, logits[i]);
      if (!Number.isFinite(maximum)) throw new Error('The decoder produced invalid scores.');
      let sum = 0;
      for (let i = 0; i < logits.length; i++) if (i !== padToken) sum += Math.exp(logits[i] - maximum);
      const normalizer = maximum + Math.log(sum);
      const top = [];
      for (let token = 0; token < logits.length; token++) {
        if (token === padToken || !Number.isFinite(logits[token])) continue;
        const score = beam.score + logits[token] - normalizer;
        if (top.length < width * 2 || score > top.at(-1).score) {
          top.push({ tokens: [...beam.tokens, token], score, state });
          top.sort((a, b) => b.score - a.score);
          if (top.length > width * 2) top.pop();
        }
      }
      candidates.push(...top);
    }
    candidates.sort((a, b) => b.score - a.score);
    const next = [];
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.tokens.at(-1) === eosToken) {
        if (index < width) completed.push({ ...candidate, state: null });
      } else if (next.length < width) next.push(candidate);
      if (next.length === width) break;
    }
    completed.sort((a, b) => rank(b) - rank(a));
    completed.splice(width);
    live = next;
    // Optimistic bound: remaining log probabilities can only lower scores.
    if (completed.length >= width && live.every(beam => beam.score / Math.pow(maxTokens, lengthPenalty) <= rank(completed.at(-1)))) break;
  }
  if (!completed.length) throw new Error('Translation did not finish within its token limit. Try a shorter passage.');
  return completed.sort((a, b) => rank(b) - rank(a))[0].tokens;
}
