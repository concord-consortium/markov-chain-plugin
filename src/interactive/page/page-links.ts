// The interactive's public name, used only by the Next Text Probability pages; the repo, the build's existing files,
// the URLs and the CODAP plugin keep their own names
export const productName = "Next Text Probability";

// The interactive's pages come in two forms from the same components: its own, which hosts and existing links open,
// and the Next Text Probability pages in next-text-probability/, with the header, footer and About dialog
export type PageId = "markov" | "next-text-probability";

// where the hosted interactive is served, as the About dialog's copy names it
export const hostName = "models-resources.concord.org";

export const termsOfUseUrl = "https://concord.org/terms-of-use/";
export const licenseUrl = "https://github.com/concord-consortium/markov-chain-plugin/blob/master/LICENSE";
export const licensingUrl = "https://concord.org/licensing";
export const licensingEmail = "licensing@concord.org";

// between the product's name and a page's own, in the header and the pages' titles
export const titleSeparator = " | ";
export const authoringSubtitle = "Authoring";

// demo.html's title, in its header and, from webpack.config.js, its tab
export const demoPageTitle = "Demo Authoring";

export const copyrightLine = () => `© ${new Date().getFullYear()} The Concord Consortium, Inc.`;
