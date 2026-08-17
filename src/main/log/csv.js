// csv.js
// Description: RFC 4180 serialization and parsing for the frozen log file
//              format. Quote a field only when it contains a comma, a quote, or
//              a line break; escape internal quotes by doubling. CRLF endings.
//              This file knows nothing about dates, folders, or rows-as-objects.
// Inputs:  arrays of string fields (serialize) / raw file text (parse)
// Outputs: CSV lines / arrays of field arrays
// Created: 2026-08-17

import { LOG_LINE_ENDING } from '../../shared/constants.js';

// Description: serialize one row of fields to a CSV line (no line ending).
// Inputs:  fields — array of strings (empty string = the literal empty field)
// Outputs: string — one RFC 4180 line
export function serializeLine(fields) {
  return fields.map(quoteField).join(',');
}

// Description: quote a single field per RFC 4180 only when required.
// Inputs:  field — string
// Outputs: string
function quoteField(field) {
  const s = String(field ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Description: serialize many rows plus a trailing line ending per line, so the
//              file always ends with CRLF and plain appends stay valid.
// Inputs:  rows — array of field arrays
// Outputs: string
export function serializeLines(rows) {
  return rows.map((r) => serializeLine(r) + LOG_LINE_ENDING).join('');
}

// Description: parse a whole CSV file body into rows of fields. Handles quoted
//              fields containing commas, doubled quotes, and embedded line
//              breaks; accepts both CRLF and LF endings (files may have been
//              edited by hand). A trailing empty line is not a row.
// Inputs:  text — string (full file contents)
// Outputs: array of field arrays
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;
  // The algorithm is a single pass; `inQuotes` flips the meaning of commas and
  // line breaks, and a doubled quote inside quotes is one literal quote.
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
      i += 1; continue;
    }
    field += ch; i += 1;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
