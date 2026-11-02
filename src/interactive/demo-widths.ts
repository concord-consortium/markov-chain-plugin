// The widths a full-width item gets in the Activity Player, for the demo page's width choice. An activity page is
// 1100px wide (LARA's "Standard"), 960px ("iPad Friendly"), or as wide as the window when a section has a responsive
// layout, and the item sits inside the page's 20px side padding and the section's 8px side margin.
export const activityPlayerInset = 2 * 20 + 2 * 8;

export const demoWidths = [
  { id: "1100", label: "Standard (1100px)", frameWidth: 1100 - activityPlayerInset },
  { id: "960", label: "iPad Friendly (960px)", frameWidth: 960 - activityPlayerInset },
  // fills the runtime area, as a responsive section fills the window
  { id: "responsive", label: "Responsive", frameWidth: undefined },
] as const;

export type DemoWidthId = typeof demoWidths[number]["id"];

export const defaultDemoWidth: DemoWidthId = "1100";

// the demo's ?width= value, or the default for a missing or unknown one
export const readDemoWidth = (search: string): DemoWidthId => {
  const width = new URLSearchParams(search).get("width");
  return demoWidths.find(w => w.id === width)?.id ?? defaultDemoWidth;
};
