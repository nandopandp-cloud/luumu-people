"use client";

/**
 * Reduz fotos e prints antes do envio (anexos de conversa): menos armazenamento no Blob,
 * menos tráfego a cada abertura e envio mais rápido. Nada é perdido de forma perceptível:
 * o lado maior vai a no máximo 1920 px e a qualidade é 85. Se não houver ganho real (ou o
 * navegador não souber converter), o arquivo original segue intacto.
 */
const MAX_SIDE = 1920;
const MIN_BYTES_TO_COMPRESS = 300 * 1024;
const QUALITY = 0.85;

export async function compressImageForUpload(file: File): Promise<File> {
  // WebP já é eficiente (e pode ser animado); PDF e outros tipos não são tocados.
  if ((file.type !== "image/png" && file.type !== "image/jpeg") || file.size < MIN_BYTES_TO_COMPRESS) return file;
  try {
    const bitmap = await createImageBitmap(file); // respeita a orientação EXIF
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    // JPEG não tem transparência: fundo branco (igual ao que o recorte de perfil já faz).
    if (file.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // PNG vira WebP (mantém a transparência); JPEG continua JPEG.
    const wanted = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, wanted, QUALITY));
    // Safari não gera WebP no canvas e devolve PNG: nesse caso, mantém o original.
    if (!blob || blob.type !== wanted || blob.size >= file.size * 0.9) return file;
    const extension = wanted === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]*$/, "") || "imagem";
    return new File([blob], `${base}.${extension}`, { type: wanted });
  } catch {
    return file;
  }
}
