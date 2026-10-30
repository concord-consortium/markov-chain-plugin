import type { CasesOperation, FakeCodap, StartOptions } from "../fake-codap/fake-codap";

export type StartPluginOptions = StartOptions & {
  /** Starts in dataset mode with this attribute of the page's dataset dropped. */
  attribute?: string;
};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Opens the fake CODAP page and starts the plugin in it with these options: saved state, dataset,
       * attribute, held init, frame size and URL query.
       */
      startPlugin(options?: StartPluginOptions): Chainable<void>;
      /** Yields the plugin's document body, to find elements in the plugin. */
      plugin(): Chainable<JQuery<HTMLElement>>;
      /** Yields the fake CODAP page's API, including the requests and output items it has received. */
      fakeCodap(): Chainable<FakeCodap>;
      /** Sends the interactiveFrame reply that startPlugin({holdInit: true}) held back. */
      releaseInit(): Chainable<void>;
      /** Replaces an attribute's values in the page's dataset; send a cases notification to tell the plugin. */
      setAttributeValues(name: string, values: unknown[]): Chainable<void>;
      /** Renames an attribute in the page's dataset, keeping its values. */
      renameAttribute(from: string, to: string): Chainable<void>;
      /** Drags an attribute of the page's dataset onto the plugin, and waits for the plugin's replies. */
      dropAttribute(name: string): Chainable<void>;
      /** Sends a dataContextChangeNotice for the page's dataset, and waits for the plugin's reply. */
      notifyCases(operation: CasesOperation): Chainable<void>;
      /** Asks the plugin for its state, as CODAP does when it saves a document, and yields the state. */
      getPluginState(): Chainable<any>;
      /** Starts the plugin again, with the same options and this saved state, as CODAP does when a document opens. */
      restartPlugin(savedState: unknown): Chainable<void>;
      /** Clicks the state with this label. */
      clickState(label: string): Chainable<void>;
      /** Clicks the state with this label twice, which the plugin reads as a double-click. */
      doubleClickState(label: string): Chainable<void>;
      /** Resizes the plugin's iframe. */
      resizePlugin(width: number, height: number): Chainable<void>;
    }
  }
}
