/** Egyptian mobile numbers: 01[0125]xxxxxxxx. Accepts +20 / 0020 / spaces / dashes; stores the local form. */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s\-().]/g, '');
  // Arabic-Indic digits → ASCII
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (s.startsWith('+20')) s = '0' + s.slice(3);
  else if (s.startsWith('0020')) s = '0' + s.slice(4);
  else if (/^20\d{10}$/.test(s)) s = '0' + s.slice(2);
  return /^01[0125]\d{8}$/.test(s) ? s : null;
}
