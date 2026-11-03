import { Capitalization } from "../authored-state";

export type Token =
  // text as typed (a bracketed token's without its brackets); start..end spans the brackets too, so an edit
  // replaces them
  | { kind: "word", text: string, state: string, start: number, end: number }
  // a blank line
  | { kind: "break", start: number, end: number };

const punctuation = ".,?!:;";
const separators = "\"(){}_+=|\\/<>[]";
const isWhitespace = (char: string) => /\s/.test(char);
export const endsWord = (char: string) => isWhitespace(char) || punctuation.includes(char) || separators.includes(char);

// where the bracket opened at start closes: the next "]" on its line with no "[" before it, or -1
export const closingBracket = (text: ArrayLike<string>, start: number) => {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "]") {
      return i;
    }
    if (text[i] === "[" || text[i] === "\n") {
      return -1;
    }
  }
  return -1;
};

export const tokenize = (text: string, capitalization: Capitalization): Token[] => {
  const tokens: Token[] = [];
  let blankLine: { start: number } | undefined;

  const addWord = (word: string, start: number, end: number) => {
    if (blankLine) {
      // the break runs to this word, over any further blank lines and dropped characters
      tokens.push({ kind: "break", start: blankLine.start, end: start });
      blankLine = undefined;
    }
    const state = capitalization === "lowercase" ? word.toLocaleLowerCase() : word;
    tokens.push({ kind: "word", text: word, state, start, end });
  };

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (isWhitespace(char)) {
      let end = i;
      let lineBreaks = 0;
      while (end < text.length && isWhitespace(text[end])) {
        lineBreaks += text[end] === "\n" ? 1 : 0;
        end++;
      }
      // a blank line after a word breaks the chain once a word follows it; blank lines in a row are one break
      if (lineBreaks >= 2 && tokens.length > 0 && !blankLine) {
        blankLine = { start: i };
      }
      i = end;
    } else if (char === "[") {
      const close = closingBracket(text, i);
      if (close === -1) {
        i++;
      } else {
        const word = text.slice(i + 1, close).trim();
        if (word) {
          addWord(word, i, close + 1);
        }
        i = close + 1;
      }
    } else if (punctuation.includes(char)) {
      addWord(char, i, i + 1);
      i++;
    } else if (separators.includes(char)) {
      i++;
    } else {
      let end = i;
      while (end < text.length && !endsWord(text[end])) {
        end++;
      }
      addWord(text.slice(i, end), i, end);
      i = end;
    }
  }
  return tokens;
};

// the values the core's dataChanged takes: each word's state, "" for each break
export const tokensToValues = (tokens: Token[]): string[] =>
  tokens.map(token => token.kind === "word" ? token.state : "");

// a table row as a token's text: trimmed, brackets removed; "" is a break
export const rowText = (row: string) => row.replace(/[[\]]/g, "").trim();

// how a row's text is written into the text: as it is when the tokenizer gives it back as one word, else in brackets
export const textForRow = (text: string) => {
  const tokens = tokenize(text, "asTyped");
  const [token] = tokens;
  return tokens.length === 1 && token.kind === "word" && token.text === text ? text : `[${text}]`;
};

// what an edit from one text to the next inserted and how many characters it removed, past their common prefix and
// suffix
export const textChange = (old: string, next: string) => {
  let prefix = 0;
  const shorter = Math.min(old.length, next.length);
  while (prefix < shorter && old[prefix] === next[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (suffix < shorter - prefix && old[old.length - 1 - suffix] === next[next.length - 1 - suffix]) {
    suffix++;
  }
  return { inserted: next.slice(prefix, next.length - suffix), removed: old.length - prefix - suffix };
};

// a character that finishes a word as it is typed, so the input commits at once
export const commitsOnTyping = (char: string) => isWhitespace(char) || punctuation.includes(char) || char === "]";
