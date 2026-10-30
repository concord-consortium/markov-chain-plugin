import { Edge, GraphData, Node } from "../type";

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

// objects without a prototype, so a word like "constructor" can't find an inherited property;
// not a Map, whose insertion order would change the order of states (integer words sort first here)
export const wordsToGraph = (words: string[]): GraphData => {
  const nodes: Record<string, Node> = Object.create(null);
  const edges: Record<string, Edge> = Object.create(null);

  words.forEach((word, index) => {
    nodes[word] = nodes[word] ?? { id: word, label: word, value: 0 };
    nodes[word].value++;

    if (index > 0) {
      const lastWord = words[index - 1];
      const key = `${lastWord}|${word}`;
      edges[key] = edges[key] ?? { from: lastWord, to: word, value: 0 };
      edges[key].value++;
    }
  });

  return { nodes: Object.values(nodes), edges: Object.values(edges) };
};
