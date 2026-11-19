// a short hash of a text, which tells it from another text without storing either
export const shortHash = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 1000003 + text.charCodeAt(i)) % 4294967291;
  }
  return hash.toString(36);
};
