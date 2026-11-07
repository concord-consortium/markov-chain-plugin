export const roundingNote = "Percents are rounded, so they may not add up to 100%";
export const outgoingOnlyNote = "Only arrows out of the chosen word are drawn";

// the notes along the bottom of the Graph pane, each only while it applies
// a chosen state stays chosen while a sequence plays, but its arrows give way to the generator's then
export const graphNotes = (s: {
  labelsShown: boolean, orderMatters: boolean, stateChosen: boolean, animating: boolean
}) => [
  ...(s.labelsShown ? [roundingNote] : []),
  ...(!s.orderMatters && s.stateChosen && !s.animating ? [outgoingOnlyNote] : []),
];
