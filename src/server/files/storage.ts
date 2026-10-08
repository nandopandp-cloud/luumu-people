import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Armazenamento de arquivos.
 *  - Produção: Vercel Blob com acesso PRIVADO (BLOB_READ_WRITE_TOKEN).
 *  - Desenvolvimento/teste: pasta temporária do sistema, FORA da árvore do
 *    projeto (o servidor de dev observa a pasta do projeto).
 * Em produção sem token, uploads falham de forma explícita.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; size: number } | null>;
  delete(key: string): Promise<void>;
}

function localDriver(): StorageDriver {
  const root = process.env.LOCAL_STORAGE_DIR ?? path.join(tmpdir(), "luumu-people-uploads");
  const resolve = (key: string) => {
    // Driver só de desenvolvimento: o comentário evita que o bundler rastreie o projeto inteiro.
    const base = path.resolve(/* turbopackIgnore: true */ root);
    const full = path.resolve(/* turbopackIgnore: true */ base, key);
    if (!full.startsWith(base + path.sep)) throw new Error("chave de armazenamento inválida");
    return full;
  };
  return {
    name: "local",
    async put(key, bytes) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, bytes);
    },
    async get(key) {
      try {
        const full = resolve(key);
        const [body, info] = await Promise.all([readFile(full), stat(full)]);
        return { body: new Uint8Array(body), size: info.size };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

function blobDriver(): StorageDriver {
  return {
    name: "vercel-blob",
    async put(key, bytes, contentType) {
      const { put } = await import("@vercel/blob");
      await put(key, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
    },
    async get(key) {
      const { get } = await import("@vercel/blob");
      const result = await get(key, { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      return { body: result.stream, size: result.blob.size };
    },
    async delete(key) {
      const { del } = await import("@vercel/blob");
      await del(key);
    },
  };
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Armazenamento não configurado: crie um Blob store na Vercel (BLOB_READ_WRITE_TOKEN).");
  }
}

let driver: StorageDriver | undefined;

export function storage(): StorageDriver {
  if (driver) return driver;
  if (process.env.BLOB_READ_WRITE_TOKEN) driver = blobDriver();
  else if (process.env.NODE_ENV === "production") throw new StorageNotConfiguredError();
  else driver = localDriver();
  return driver;
}

/** Testes: injeta um driver. */
export function setStorageDriver(next: StorageDriver | undefined) {
  driver = next;
}
