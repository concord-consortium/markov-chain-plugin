import { GraphData } from "../type";
import { chainsToGraph } from "./chain-graph";

const keepPunctuationRegex = /[.,?!:;]/g;
const removePunctuationRegex = /["(){}[\]_+=|\\/><]/g;

export const textToWords = (text: string) => {
  return text
    .replace(keepPunctuationRegex, (match) => ` ${match} `)
    .replace(removePunctuationRegex, " ")
    .split(/\s/)
    .map(w => w.trim().toLocaleLowerCase())
    .filter(w => w.length > 0);
};

// text's states come in a plain object's key order: words that are array indexes ("0", "12") first in numeric
// order, then the rest as they first appear
const isArrayIndex = (word: string) => /^(0|[1-9]\d*)$/.test(word) && Number(word) < 2 ** 32 - 1;

export const wordsToGraph = (words: string[]): GraphData => {
  const { nodes, edges } = chainsToGraph([words]);
  const indexes = nodes.filter(n => isArrayIndex(n.id)).sort((a, b) => Number(a.id) - Number(b.id));
  return { nodes: [...indexes, ...nodes.filter(n => !isArrayIndex(n.id))], edges };
};
