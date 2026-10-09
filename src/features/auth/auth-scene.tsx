import { ChartColumn, GraduationCap, Star, Users } from "lucide-react";
import Image from "next/image";
import { Wordmark } from "@/design-system/components/brand";
import { cn } from "@/design-system/cn";

const FEATURES = [
  { icon: GraduationCap, label: "Desenvolvimento contínuo", box: "bg-purple-100 text-purple-600" },
  { icon: Users, label: "Cultura e engajamento", box: "bg-blue-100 text-blue-700" },
  { icon: ChartColumn, label: "Pesquisas e insights reais", box: "bg-purple-100 text-purple-600" },
  { icon: Star, label: "Conquistas que impulsionam", box: "bg-orange-100 text-orange-500", fill: true },
];

/**
 * Painel de marca das telas de acesso. Em telas largas (xl), a ilustração da
 * marca (public/images/login-scene.webp) ocupa toda a altura do painel, com um corte
 * leve à direita (só os livros), para o Luumu ficar ao lado dos textos; logo, título, recursos e rodapé são HTML real à esquerda, sobre um
 * véu claro.
 * Abaixo de 1280 px, só o gradiente.
 */
export function AuthScene() {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50">
      {/* Ilustração encostada embaixo e à direita, no maior tamanho em que o Luumu
          ainda começa depois da coluna de texto (300px). Só os livros são cortados à
          direita; bordas esquerda e superior se dissolvem no gradiente. */}
      <div
        aria-hidden
        className="absolute bottom-0 right-0 hidden aspect-[1374/1145] translate-x-[9%] xl:block"
        style={{
          width: "min(calc((100% - 300px) * 4 / 3), calc(100dvh * 1.2))",
          maskImage: "linear-gradient(to right, transparent 0, #000 14%), linear-gradient(to bottom, transparent 0, #000 12%)",
          maskComposite: "intersect",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 14%), linear-gradient(to bottom, transparent 0, #000 12%)",
          WebkitMaskComposite: "source-in",
        }}
      >
        <Image src="/images/login-scene.webp" alt="" fill priority quality={90} sizes="(min-width: 1280px) 60vw, 0px" className="object-cover" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 hidden xl:block"
        style={{ background: "linear-gradient(to right, var(--color-purple-50) 0, var(--color-purple-50) 200px, transparent 300px)" }}
      />

      <div className="relative flex h-full flex-col px-14 pb-8 pt-9 [@media(max-height:760px)]:pb-6 [@media(max-height:760px)]:pt-7">
        <Wordmark className="h-auto w-[220px] max-w-full" />
        {/* Quebras de linha da referência de design. */}
        <p className="mt-5 whitespace-nowrap text-[1.9rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-neutral-900 xl:text-[2.1rem]">
          Pessoas que
          <br />
          aprendem, crescem
          <br />e <span className="text-purple-500">constroem</span>
          <br />
          <span className="text-purple-500">juntas.</span>
        </p>
        <p className="mt-3 max-w-[270px] text-body-sm leading-relaxed text-neutral-600 [@media(max-height:760px)]:hidden">
          A Luumu People é a plataforma de experiência, desenvolvimento e inteligência de pessoas que conecta aprendizado, cultura e resultados dentro da sua empresa.
        </p>
        <ul className="mt-5 space-y-3 [@media(max-height:760px)]:space-y-2">
          {FEATURES.map(({ icon: Icon, label, box, fill }) => (
            <li key={label} className="flex items-center gap-4">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", box)}>
                <Icon aria-hidden className={cn("size-5", fill && "fill-current")} strokeWidth={2.4} />
              </span>
              <span className="max-w-[8.5rem] text-body-sm font-medium leading-snug text-neutral-800">{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4 [@media(max-height:700px)]:hidden">
          <div aria-hidden className="flex gap-2">
            <span className="h-1.5 w-[52px] rounded-full bg-purple-500" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
          </div>
          <p className="mt-4 max-w-[12rem] text-caption text-neutral-600">Uma plataforma completa para o futuro das pessoas.</p>
        </div>
      </div>
    </div>
  );
}
