"use client";

import { RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";

export type ImageEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL local (object URL) da imagem escolhida. */
  src: string | null;
  title: string;
  /** Proporção do recorte (largura / altura). */
  aspect: number;
  shape: "round" | "rect";
  /** Tamanho final exportado, em pixels. */
  output: { width: number; height: number };
  pending?: boolean;
  error?: string | null;
  onSave: (blob: Blob) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** Editor de imagem: arrastar para enquadrar, zoom e rotação (livre ou de 90°). Exporta JPEG recortado. */
export function ImageEditor({ open, onOpenChange, src, title, aspect, shape, output, pending, error, onSave }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  async function save() {
    if (!src || !area) return;
    setWorking(true);
    try {
      onSave(await renderCrop(src, area, rotation, output));
    } finally {
      setWorking(false);
    }
  }

  const busy = pending || working;
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="lg"
      title={title}
      description="Arraste para enquadrar. Use o zoom e a rotação para ajustar."
      footer={
        <>
          <Button variant="tertiary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy} disabled={!area}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? <Alert tone="error" title={error} /> : null}
        <div className="relative h-72 overflow-hidden rounded-lg bg-neutral-900 sm:h-80">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={shape}
              showGrid={shape === "rect"}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              disableAutomaticStylesInjection
              keyboardStep={5}
            />
          ) : null}
        </div>

        <Slider label="Zoom" value={zoom} min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} onChange={setZoom} format={(v) => `${Math.round(v * 100)}%`} left={<ZoomOut aria-hidden className="size-4" />} right={<ZoomIn aria-hidden className="size-4" />} />
        <Slider label="Rotação" value={rotation} min={-180} max={180} step={1} onChange={setRotation} format={(v) => `${v}°`} left={<RotateCcw aria-hidden className="size-4" />} right={<RotateCw aria-hidden className="size-4" />} />

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRotation((r) => normalizeAngle(r - 90))}>
            <RotateCcw aria-hidden /> Girar à esquerda
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRotation((r) => normalizeAngle(r + 90))}>
            <RotateCw aria-hidden /> Girar à direita
          </Button>
          <Button variant="tertiary" size="sm" onClick={reset}>
            <Undo2 aria-hidden /> Restaurar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Slider({ label, value, min, max, step, onChange, format, left, right }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; left: React.ReactNode; right: React.ReactNode }) {
  const id = `slider-${label}`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-body-sm">
        <label htmlFor={id} className="font-medium text-neutral-800">
          {label}
        </label>
        <span className="tabular-nums text-neutral-600">{format(value)}</span>
      </div>
      <div className="flex items-center gap-3 text-neutral-600">
        {left}
        <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={format(value)} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-purple-500" />
        {right}
      </div>
    </div>
  );
}

const normalizeAngle = (deg: number) => (((deg + 180) % 360) + 360) % 360 - 180;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    image.src = src;
  });
}

/** Aplica a rotação e recorta a área escolhida, redimensionando para o tamanho final. */
async function renderCrop(src: string, area: Area, rotation: number, output: { width: number; height: number }): Promise<Blob> {
  const image = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const boundW = image.width * cos + image.height * sin;
  const boundH = image.width * sin + image.height * cos;

  const rotated = document.createElement("canvas");
  rotated.width = Math.round(boundW);
  rotated.height = Math.round(boundH);
  const rctx = rotated.getContext("2d")!;
  rctx.translate(boundW / 2, boundH / 2);
  rctx.rotate(rad);
  rctx.translate(-image.width / 2, -image.height / 2);
  rctx.drawImage(image, 0, 0);

  const out = document.createElement("canvas");
  out.width = output.width;
  out.height = output.height;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);

  return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))), "image/jpeg", 0.9));
}
