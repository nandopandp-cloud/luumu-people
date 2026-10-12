import { cn } from "@/design-system/cn";
import { moodArt } from "@/lib/moods";

/** Ameixa do sentimento (public/brand/moods). Decorativa por padrão; informe `label` quando transmitir o sentimento. */
export function MoodArt({ slug, label, className }: { slug: string; label?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca (vetor: o otimizador não ganha nada)
  return <img src={moodArt(slug)} alt={label ?? ""} width={460} height={460} draggable={false} className={cn("select-none", className)} />;
}
