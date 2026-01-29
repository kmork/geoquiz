export const strip = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const norm = (s) =>
  strip(String(s).toLowerCase())
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
