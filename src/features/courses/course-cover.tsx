import { cn } from "@/design-system/cn";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";

/** Capa de curso/trilha: imagem enviada (privada, servida pela API) ou capa ilustrada do design system. */
export function CourseCover({ coverFileId, theme, illustration, className, iconClassName }: { coverFileId: string | null; theme: CoverTheme; illustration: CoverIllustration; className?: string; iconClassName?: string }) {
  if (coverFileId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
      <img src={`/api/v1/files/${coverFileId}`} alt="" className={cn("object-cover", className)} loading="lazy" />
    );
  }
  return <CoverArt theme={theme} illustration={illustration} className={className} iconClassName={iconClassName} />;
}
