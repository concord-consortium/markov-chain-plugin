export const compareStateLabels = (a: {label: unknown}, b: {label: unknown}) =>
  String(a.label).localeCompare(String(b.label), undefined, {numeric: true});
