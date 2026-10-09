/**
 * Validação de arquivos enviados — PURA (sem I/O), testável.
 *
 * O tipo é detectado pelos BYTES INICIAIS (magic bytes), nunca pela extensão
 * ou pelo Content-Type declarado pelo navegador. SVG, HTML e executáveis são
 * recusados por padrão (vetores de XSS/malware).
 */
export const FILE_PURPOSES = ["avatar", "course_cover", "announcement_cover", "lesson_material", "library_material", "home_banner", "profile_cover", "announcement_attachment"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export type DetectedType = { mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; extension: "png" | "jpg" | "webp" | "pdf" };

const MB = 1024 * 1024;

/** Regras por finalidade. Limite máximo da plataforma: 4 MB (corpo de função na Vercel = 4,5 MB). */
export const UPLOAD_RULES: Record<FilePurpose, { mimes: DetectedType["mime"][]; maxBytes: number; label: string }> = {
  avatar: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 2 * MB, label: "PNG, JPG ou WEBP até 2 MB" },
  course_cover: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 4 * MB, label: "PNG, JPG ou WEBP até 4 MB" },
  announcement_cover: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 3 * MB, label: "PNG, JPG ou WEBP até 3 MB" },
  lesson_material: { mimes: ["application/pdf", "image/png", "image/jpeg", "image/webp"], maxBytes: 4 * MB, label: "PDF ou imagem até 4 MB" },
  home_banner: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 3 * MB, label: "PNG, JPG ou WEBP até 3 MB" },
  profile_cover: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 3 * MB, label: "PNG, JPG ou WEBP até 3 MB" },
  announcement_attachment: { mimes: ["application/pdf", "image/png", "image/jpeg", "image/webp"], maxBytes: 4 * MB, label: "PDF ou imagem até 4 MB" },
  library_material: { mimes: ["application/pdf", "image/png", "image/jpeg", "image/webp"], maxBytes: 4 * MB, label: "PDF ou imagem até 4 MB" },
};

export const MAX_UPLOAD_BYTES = 4 * MB;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((b, i) => bytes[offset + i] === b);
}

export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", extension: "webp" };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", extension: "pdf" };
  return null;
}

export type UploadValidation = { ok: true; type: DetectedType } | { ok: false; message: string };

export function validateUpload(purpose: FilePurpose, bytes: Uint8Array): UploadValidation {
  const rule = UPLOAD_RULES[purpose];
  if (bytes.byteLength === 0) return { ok: false, message: "O arquivo está vazio." };
  if (bytes.byteLength > rule.maxBytes) return { ok: false, message: `O arquivo passa do limite. Envie ${rule.label}.` };
  const type = detectFileType(bytes);
  if (!type || !rule.mimes.includes(type.mime)) return { ok: false, message: `Formato não aceito. Envie ${rule.label}.` };
  return { ok: true, type };
}

/** Nome exibido: sem caminhos, sem caracteres de controle, tamanho limitado. Nunca usado como chave de armazenamento. */
export function sanitizeFileName(name: string, extension: string): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\.[^.]*$/, "")
    .trim()
    .slice(0, 120);
  return `${base || "arquivo"}.${extension}`;
}
