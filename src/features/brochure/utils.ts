import {uploadImage}from '../../api/client';
export const CAMPAIGN_TYPES = [
  ["Black Friday", "Oferta që nuk priten!"],
  ["Happy Hour", "Oferta speciale vetëm për pak orë!"],
  ["e-days", "Bli online me oferta të veçanta."],
  ["Year-end Holidays", "Festat e fundvitit vijnë me oferta speciale!"],
  ["Summer", "Përjetoni freski në çmime."],
  ["Valentine's Day", "Dhurata dhe oferta për Shën Valentin."],
  ["NEPTUN Anniversary", "Festojmë bashkë me oferta ekskluzive!"],
  ["Back to University", "Zbuloni ofertat që i japin ngjyra vjeshtës."],
  ["Back to School", "Gati për shkollë? Gati për oferta!"],
  ["haPPy Day", "Një ditë plot oferta speciale."],
  ["Spring offers", "Përfito nga magjia e ofertave pranverore!"],
  ["Other", "Zbuloni ofertat tona më të mira."],
];

export function parsePrice(input: unknown) {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  let raw = String(input ?? "").replace(/(?:EUR|USD|GBP|€|\$|£|\s)/gi, "");
  if (!raw) return NaN;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma !== -1 && dot !== -1)
    raw =
      comma > dot
        ? raw.replaceAll(".", "").replace(",", ".")
        : raw.replaceAll(",", "");
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, "");
  else if (comma !== -1) raw = raw.replace(",", ".");
  return Number(raw);
}

export function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function readImage(file:File|null|undefined):Promise<string> {
  return file ? uploadImage(file) : '';
}

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
