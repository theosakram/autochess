// Glossary terms: a commander's text stays a short summary, and the fine print sits behind an underlined
// link that opens it in a popup (data-action="openTerm"). Each commander lists its own in `terms`; the UI
// can add a table under a term's body (views.ts, TERM_TABLES).

export interface Term {
  icon: string;
  title: string;
  body: string; // rules HTML
}

// The underlined link that opens term `id`.
export const term = (id: string, label: string): string =>
  `<button class="text-link" data-action="openTerm" data-term="${id}">${label}</button>`;

// A term body's rules, one point per line.
export const list = (...points: string[]): string => `<ul class="term-list">${points.map((p) => `<li>${p}</li>`).join('')}</ul>`;
