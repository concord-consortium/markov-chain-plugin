import type { FakeAp, ItemsType, StartOptions } from "../fake-ap/fake-ap";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Opens the fake Activity Player page and starts the Markov Interactive in it, in the mode given. */
      startInteractive(options: StartOptions): Chainable<void>;
      /** Yields the interactive's document body, to find elements in the interactive. */
      interactive(): Chainable<JQuery<HTMLElement>>;
      /** Yields the fake Activity Player page's API, including the messages the interactive has sent. */
      fakeAp(): Chainable<FakeAp>;
      /** Yields the content of every message of this type the interactive has sent, oldest first, retrying. */
      interactiveMessages(type: string, options?: Partial<Timeoutable>): Chainable<unknown[]>;
      /** Waits until the host's frame is as tall as the interactive's content, as its height messages ask. */
      frameFitsInteractive(): Chainable<void>;
      /** Asks the report item for a student's answer (student1's by default), as the class dashboard does. */
      requestReportItemAnswer(itemsType: ItemsType, platformUserId?: string): Chainable<any>;
    }
  }
}
