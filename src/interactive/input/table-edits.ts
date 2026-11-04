import {
  closingBracket, commonEnds, endsWord, isWhitespace, punctuation, rowText, textForRow, Token
} from "./tokenizer";

// Each returns the new text; tokens are the text's current tokens, and row indexes count breaks as rows.

const isSpace = (char: string | undefined) => char !== undefined && isWhitespace(char) && char !== "\n";
// a character that would run into a word written beside it
const joins = (char: string | undefined) => char !== undefined && !endsWord(char);

// A "[" the tokenizer dropped, since another "[" or a line break came before its "]", could pair once an edit at
// start removes what stood between; it becomes a "(", which the tokenizer also drops but which never pairs. The
// ones nearest the edit go first, since a "(" no longer stops a "[" before it.
const keepUnpaired = (text: string, edited: string, start: number) => {
  const chars = edited.split("");
  for (let i = start - 1; i >= 0 && chars[i] !== "\n"; i--) {
    if (chars[i] === "[" && closingBracket(text, i) === -1 && closingBracket(chars, i) !== -1) {
      chars[i] = "(";
    }
  }
  return chars.join("");
};

// text from start to end replaced, with a space on a side where a word would run into the text beside it
const write = (text: string, start: number, end: number, written: string) => {
  const before = joins(written[0]) && joins(text[start - 1]) ? " " : "";
  const after = joins(written[written.length - 1]) && joins(text[end]) ? " " : "";
  return keepUnpaired(text, text.slice(0, start) + before + written + after + text.slice(end), start);
};

// the line breaks in the whitespace beside position from, looking back (-1) or ahead (1), and where it ends
const lineBreaksIn = (text: string, from: number, direction: -1 | 1) => {
  let count = 0;
  let i = direction === 1 ? from : from - 1;
  while (i >= 0 && i < text.length && isWhitespace(text[i])) {
    count += text[i] === "\n" ? 1 : 0;
    i += direction;
  }
  return { count, end: direction === 1 ? i : i + 1 };
};

// text from start to end removed, leaving a space where the words on either side would otherwise join
const cut = (text: string, start: number, end: number) => keepUnpaired(
  text, text.slice(0, start) + (joins(text[start - 1]) && joins(text[end]) ? " " : "") + text.slice(end), start);

export const editRow = (text: string, tokens: Token[], row: number, value: string): string => {
  const token = tokens[row];
  const word = rowText(value);
  if (token.kind === "break") {
    return word ? write(text, token.start, token.end, `\n${textForRow(word)}\n`) : text;
  }
  if (word) {
    return write(text, token.start, token.end, textForRow(word));
  }
  // an emptied row is a blank line, which takes in the whitespace around the word; at either end of the input the
  // tokenizer reads no break there, so the row goes
  let start = token.start;
  let end = token.end;
  while (start > 0 && isWhitespace(text[start - 1])) {
    start--;
  }
  while (end < text.length && isWhitespace(text[end])) {
    end++;
  }
  return text.slice(0, start) + "\n\n" + text.slice(end);
};

export const insertRow = (text: string, tokens: Token[], after: number, value: string): string => {
  const word = rowText(value);
  if (!word) {
    return text;
  }
  const written = textForRow(word);
  if (after < 0) {
    return tokens.length > 0 ? write(text, tokens[0].start, tokens[0].start, `${written} `) : text + written;
  }
  const token = tokens[after];
  if (token.kind === "break") {
    // after a blank line, so it doesn't run into the next word
    return write(text, token.end, token.end, `${written} `);
  }
  const isPunctuation = written.length === 1 && punctuation.includes(written);
  return write(text, token.end, token.end, isPunctuation ? written : ` ${written}`);
};

export const deleteRow = (text: string, tokens: Token[], row: number): string => {
  const token = tokens[row];
  if (token.kind === "break") {
    // the words on either side join the chain
    return write(text, token.start, token.end, " ");
  }
  // a word alone on its line goes with the line break after it, so its two line breaks don't make a blank line
  const lineBreaksBefore = lineBreaksIn(text, token.start, -1);
  const lineBreaksAfter = lineBreaksIn(text, token.end, 1);
  if (lineBreaksBefore.count === 1 && lineBreaksAfter.count === 1) {
    return cut(text, token.start, lineBreaksAfter.end);
  }
  // the space before the word, or after it when there's none before; a line break stays, so no blank line is lost
  if (isSpace(text[token.start - 1])) {
    return cut(text, token.start - 1, token.end);
  }
  if (isSpace(text[token.end])) {
    return cut(text, token.start, token.end + 1);
  }
  return cut(text, token.start, token.end);
};

// Where a place in the text before an edit lies after it. The edit is the run between the two texts' common start and
// common end: a place before the run keeps its offset, one after it moves with the change in length, and one inside
// it is placed at the run's start.
export const placeAfterEdit = (before: string, after: string, place: number) => {
  const { prefix: start, suffix: end } = commonEnds(before, after);
  if (place < start) {
    return { place, inside: false };
  }
  if (place >= before.length - end) {
    return { place: place + after.length - before.length, inside: false };
  }
  return { place: start, inside: true };
};
