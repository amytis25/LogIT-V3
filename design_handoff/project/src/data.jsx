// Mock data shared across screens.

const CATEGORIES = [
  { label: 'Deep Work',   color: '#c0653b', hours: 14.5 },
  { label: 'Meetings',    color: '#5b78a3', hours:  6.0 },
  { label: 'Review',      color: '#7a8a3a', hours:  3.5 },
  { label: 'Email',       color: '#a85a8a', hours:  2.0 },
  { label: 'Breaks',      color: '#c8a23b', hours:  4.0 },
  { label: 'Research',    color: '#3a8a85', hours:  5.5 },
  { label: 'Admin',       color: '#8a6b3a', hours:  1.5 },
];

const PROJECTS = [
  { label: 'Frontend',         color: '#5b78a3', hours: 12.0 },
  { label: 'API Migration',    color: '#c0653b', hours:  7.5 },
  { label: 'Design System',    color: '#7a8a3a', hours:  5.5 },
  { label: 'Q3 Planning',      color: '#a85a8a', hours:  3.5 },
  { label: 'Hiring',           color: '#c8a23b', hours:  2.0 },
  { label: 'Personal',         color: '#3a8a85', hours:  4.5 },
  { label: '— Unassigned',     color: '#9a9a9e', hours:  2.0 },
];

// 7 days of entries: per day, list of { start, end, cat, proj, notes, mode }.
const DAYS = (() => {
  // Use a stable date so output is deterministic.
  const today = new Date('2026-05-20');
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const fmt = (d) => d.toISOString().slice(0, 10);
  const days = [];
  // Hand-tuned to look like a real week.
  const templates = [
    // 6 days ago (Wed)
    [
      ['09:00','10:30','Deep Work','Frontend','Routing refactor'],
      ['10:30','11:00','Email','—','Inbox triage'],
      ['11:00','12:00','Meetings','Q3 Planning','Sprint planning'],
      ['13:00','15:00','Deep Work','Frontend','Component library'],
      ['15:00','15:30','Breaks','—',''],
      ['15:30','17:30','Review','Design System','PR reviews'],
    ],
    // 5 days ago
    [
      ['09:00','12:00','Deep Work','API Migration','Schema design', 'focus'],
      ['13:00','14:00','Meetings','Hiring','Eng candidate'],
      ['14:00','16:00','Deep Work','API Migration','Endpoint impl'],
      ['16:00','17:00','Research','Frontend','RSC patterns'],
    ],
    // 4 days ago
    [
      ['09:30','10:30','Email','—','Mail catch-up'],
      ['10:30','12:30','Deep Work','Frontend','Dashboard widgets'],
      ['13:30','15:30','Meetings','Q3 Planning','Roadmap workshop'],
      ['15:30','17:00','Review','Frontend','Design review'],
    ],
    // 3 days ago
    [
      ['09:00','11:00','Deep Work','Design System','Tokens refresh'],
      ['11:00','12:00','Meetings','—','1:1s'],
      ['13:00','17:00','Deep Work','API Migration','Auth flow', 'focus'],
    ],
    // 2 days ago
    [
      ['09:00','10:00','Breaks','—','Coffee + plan'],
      ['10:00','12:00','Deep Work','Frontend','Animations'],
      ['13:00','14:30','Review','Design System','Tokens PR'],
      ['14:30','15:30','Meetings','Hiring','Debrief'],
      ['15:30','17:30','Research','Personal','Reading'],
    ],
    // yesterday
    [
      ['09:00','12:00','Deep Work','Frontend','Settings UI', 'focus'],
      ['13:00','14:00','Meetings','Q3 Planning','OKRs'],
      ['14:00','17:30','Deep Work','Frontend','Settings UI cont.'],
    ],
    // today (partial)
    [
      ['09:00','10:00','Email','—','Triage'],
      ['10:00','11:30','Meetings','Q3 Planning','Stakeholder sync'],
      ['11:30','12:30','Deep Work','Frontend','Logging UI'],
    ],
  ];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    days.push({
      date: fmt(d),
      day: dayNames[d.getDay()],
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${dayNames[d.getDay()]} ${d.getDate()}`,
      isToday: i === 0,
      entries: (templates[6 - i] || []).map(([s, e, cat, proj, notes, mode]) => ({
        start: s, end: e, cat, proj, notes, mode: mode || 'auto',
      })),
    });
  }
  return days;
})();

// Helpers.
function hoursOf(entry) {
  const [sh, sm] = entry.start.split(':').map(Number);
  const [eh, em] = entry.end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}
function dayHours(d) { return d.entries.reduce((s, e) => s + hoursOf(e), 0); }
function catColor(label) { return (CATEGORIES.find((c) => c.label === label) || {}).color || '#9a9a9e'; }
function projColor(label) { return (PROJECTS.find((p) => p.label === label) || {}).color || '#9a9a9e'; }

Object.assign(window, { CATEGORIES, PROJECTS, DAYS, hoursOf, dayHours, catColor, projColor });
