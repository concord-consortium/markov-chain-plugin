/**
 * @jest-environment node
 */
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpackConfig from "../../webpack.config.js";
import { authoringSubtitle, demoPageTitle, productName, titleSeparator } from "./page/page-links";

// the pages the production build writes, by file name
const builtPages = () => {
  const config = webpackConfig({}, { mode: "production" });
  const pages = config.plugins.filter(plugin => plugin instanceof HtmlWebpackPlugin);
  return { entries: config.entry as Record<string, string>,
    pages: Object.fromEntries(pages.map(page => [page.userOptions.filename, page.userOptions])) };
};

describe("the build's interactive pages", () => {
  it("titles the Next Text Probability pages as their headers name them", () => {
    const { pages } = builtPages();
    expect(pages["next-text-probability/index.html"].title).toBe(productName);
    expect(pages["next-text-probability/authoring.html"].title)
      .toBe(`${productName}${titleSeparator}${authoringSubtitle}`);
  });

  it("keeps the interactive's own pages' title", () => {
    const { pages } = builtPages();
    ["interactive.html", "report-item.html"].forEach(page =>
      expect(pages[page].title).toBe("Markov Interactive"));
    expect(pages["demo.html"].title).toBe(demoPageTitle);
  });

  it("loads the Next Text Probability pages' assets from the folder above", () => {
    const { entries, pages } = builtPages();
    ["next-text-probability/index.html", "next-text-probability/authoring.html"].forEach(page => {
      expect(pages[page].publicPath).toBe("..");
      expect(entries[(pages[page].chunks as string[])[0]]).toMatch(/^\.\/src\/interactive\/next-text-probability\//);
    });
  });
});
