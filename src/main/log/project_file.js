// project_file.js
// Description: the pure half of the project-log mirror (SPEC §3.1) — turns a
//              free-text category or project into a writable file name, shapes
//              a daily row into the project file's four columns, and answers
//              whether a row is complete enough to mirror at all. Deliberately
//              knows nothing about folders or the filesystem: LogStore stays
//              the only thing that builds a path (CLAUDE.md §5.1).
// Inputs:  category / project names as free text; row objects
//          {start, end, kind, category, project, notes}; dates as 'YYYY-MM-DD'
// Outputs: sanitized name strings; arrays of 4 fields; booleans
// Created: 2026-08-27

import {
  ILLEGAL_PATH_CHARS_RE, PATH_NAME_REPLACEMENT, RESERVED_NAME_PREFIX,
  WINDOWS_RESERVED_NAMES
} from '../../shared/constants.js';

// Description: a free-text name as a file or folder name Windows will accept.
//              Names stay unrestricted everywhere else in the app and in the
//              daily log — sanitizing here, at the one place a path is built,
//              is what keeps the two from having to agree (SPEC §3.1).
//              Replace, then trim, then check reserved: 'CON.' must still be
//              caught. Windows reserves a device name for the segment before
//              the first dot regardless of what follows, so 'CON.notes' is
//              exactly as unwritable as bare 'CON' — the check must run on
//              that leading segment, not the whole trimmed name. Separators
//              are replaced rather than dropped, so no name can climb out of
//              the Projects folder.
// Inputs:  name — any string (null/undefined tolerated)
// Outputs: a writable name, or '' when the name has no writable form
export function sanitizePathName(name) {
  const replaced = String(name ?? '').replace(ILLEGAL_PATH_CHARS_RE, PATH_NAME_REPLACEMENT);
  // Windows silently drops trailing dots and spaces, so a name ending in them
  // would resolve to a different file than the one we think we wrote.
  const trimmed = replaced.trim().replace(/[. ]+$/, '');
  const baseBeforeFirstDot = trimmed.split('.')[0];
  let safe = trimmed;
  if (WINDOWS_RESERVED_NAMES.includes(baseBeforeFirstDot.toUpperCase())) {
    safe = RESERVED_NAME_PREFIX + trimmed;
  }
  return safe;
}

// Description: is this row complete enough to belong in a project file? This
//              one predicate replaces every per-event special case: an open row
//              has no end, a timed-out row has no category or project, and a
//              deleted row never reaches here.
// Inputs:  row — row object
// Outputs: boolean
export function isMirrorable(row) {
  return row.end !== '' && row.category !== '' && row.project !== '';
}

// Description: a daily row as the project file's four ordered fields. The
//              category and project are the folder and file name, so they are
//              not repeated inside the file; the kind has no column at all —
//              the project file is a mirror for reading, not a second source of
//              truth.
// Inputs:  dateStr — 'YYYY-MM-DD', the date of the daily file the row lives in
//          row — row object
// Outputs: array of 4 strings
export function projectRowFields(dateStr, row) {
  return [dateStr, row.start, row.end, row.notes].map((v) => v ?? '');
}
