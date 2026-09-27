// S-06 Meta leads: read the Ads Manager export (xlsx, or CSV — Meta's is UTF-16 tab-separated) into Lead rows.
// No spreadsheet library: an xlsx is a zip of XML files, and node:zlib inflates it.
import { inflateRawSync } from "node:zlib";
import { normalizePhone } from "./phone";

export type LeadRow = {
  metaLeadId: string;
  campaign: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  receivedAt: Date;
  raw: Record<string, string>;
};

// Meta's own columns — everything else in a row is an answer to the form's questions.
const META_COLUMNS = new Set(
  "id created_time ad_id ad_name adset_id adset_name campaign_id campaign_name form_id form_name is_organic platform lead_status full_name first_name last_name phone_number email".split(" "),
);
const NAME = ["full_name", "שם מלא", "שם"];
const PHONE = ["phone_number", "phone", "טלפון", "מספר טלפון"];
const EMAIL = ["email", "אימייל"];

export const leadAnswers = (raw: Record<string, string>) =>
  Object.entries(raw).filter(([k]) => !META_COLUMNS.has(k) && ![...NAME, ...PHONE, ...EMAIL].includes(k));

// File bytes → rows of cells. Throws a Hebrew message for files we can't read.
export function readSheet(buf: Buffer): string[][] {
  if (buf.readUInt32LE(0) === 0x04034b50) return readXlsx(buf); // "PK\3\4"
  if (buf.readUInt32LE(0) === 0xe011cfd0) throw new Error("קובץ Excel ישן (xls) — יש לשמור אותו כ-xlsx או CSV");
  return readCsv(buf);
}

// Header row → one LeadRow per data row with an id. null when there's no "id" column (not a Meta export).
export function parseLeads(rows: string[][]): LeadRow[] | null {
  const [header = [], ...body] = rows;
  const keys = header.map((h) => h.trim().toLowerCase());
  if (!keys.includes("id")) return null;

  return body.flatMap((cells) => {
    const raw: Record<string, string> = Object.fromEntries(
      keys.map((k, i) => [k, (cells[i] ?? "").trim()] as const).filter(([k, v]) => k && v),
    );
    const id = unprefix(raw.id ?? "");
    if (!id) return [];
    const pick = (names: string[]) => names.map((n) => raw[n]).find(Boolean) ?? null;
    const phone = pick(PHONE) && unprefix(pick(PHONE)!);
    return [{
      metaLeadId: id,
      campaign: raw.campaign_name ?? null,
      fullName: pick(NAME) ?? ([raw.first_name, raw.last_name].filter(Boolean).join(" ") || null),
      phone: phone && (normalizePhone(phone) ?? phone),
      email: pick(EMAIL),
      receivedAt: parseTime(raw.created_time),
      raw,
    }];
  });
}

// Meta's export prefixes ids and phones ("l:123…", "p:+972…") so Excel keeps them as text.
const unprefix = (v: string) => v.replace(/^[a-z]{1,2}:/, "");

function parseTime(v: string | undefined) {
  if (v && /^\d+(\.\d+)?$/.test(v)) return new Date(Math.round((+v - 25569) * 86_400_000)); // Excel date serial
  const d = v ? new Date(v) : null;
  return d && !isNaN(+d) ? d : new Date();
}

function readCsv(buf: Buffer): string[][] {
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le", 2) : buf.toString("utf8").replace(/^﻿/, "");
  const sep = text.split("\n", 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') cell += text[i++];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === sep) endCell();
    else if (c === "\n") {
      endCell();
      rows.push(row);
      row = [];
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  return rows;
}

// ponytail: first sheet only (xl/worksheets/sheet1.xml), no zip64 — a Meta export is one small sheet.
function readXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const xml = (name: string) => files.get(name)?.toString("utf8") ?? "";
  const shared = [...xml("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  return [...xml("xl/worksheets/sheet1.xml").matchAll(/<row\b[^>]*?(?<!\/)>([\s\S]*?)<\/row>/g)].map(([, row]) => {
    const cells: string[] = [];
    for (const [, attrs, body = ""] of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)/.exec(attrs)?.[1];
      const col = ref ? [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : cells.length;
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      cells[col] = type === "s" ? (shared[+v] ?? "") : type === "inlineStr" ? texts(body) : unescapeXml(v);
    }
    return Array.from(cells, (c) => c ?? "");
  });
}

const texts = (xml: string) => unescapeXml([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] !== "#" ? (ENTITIES[e] ?? m) : String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)),
  );

// Zip central directory → { name: bytes }. Entries are stored (0) or deflated (8), which is all Excel writes.
function unzip(buf: Buffer) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("הקובץ פגום");
  const files = new Map<string, Buffer>();
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
    const [method, size, nameLen] = [buf.readUInt16LE(p + 10), buf.readUInt32LE(p + 20), buf.readUInt16LE(p + 28)];
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(buf.toString("utf8", p + 46, p + 46 + nameLen), method === 8 ? inflateRawSync(data) : data);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}
