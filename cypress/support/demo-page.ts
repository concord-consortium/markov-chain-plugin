// Helpers for the authoring pages, demo.html and next-text-probability/authoring.html, which frame the interactive

export const frameBody = (title: string) =>
  cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body));

// iframe-phone posts an object, or its JSON where a browser can only post text
export const messageOf = (data: unknown) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
};
