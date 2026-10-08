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
 * Painel de marca das telas de acesso. Em telas largas, a cena ilustrada da
 * referência de design (public/images/login-scene.jpg, com as áreas de texto
 * limpas) é o fundo do painel; logo, título, recursos e rodapé são HTML real
 * por cima, nas mesmas posições. Abaixo de 1280 px, só o gradiente.
 */
export function AuthScene() {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50">
      <Image
        src="/images/login-scene.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="(min-width: 1280px) 60vw, 0px"
        className="hidden object-cover object-right-bottom xl:block"
      />

      <div className="relative flex h-full flex-col px-16 pb-12 pt-14">
        <Wordmark className="h-auto w-[292px] max-w-full" />
        {/* Quebras de linha da referência de design. */}
        <p className="mt-7 whitespace-nowrap text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-neutral-900 xl:text-[2.75rem]">
          Pessoas que
          <br />
          aprendem, crescem
          <br />e <span className="text-purple-500">constroem</span>
          <br />
          <span className="text-purple-500">juntas.</span>
        </p>
        <p className="mt-3 max-w-[310px] text-[17px] leading-[1.55] text-neutral-600">
          A Luumu People é a plataforma de experiência, desenvolvimento e inteligência de pessoas que conecta aprendizado, cultura e resultados dentro da sua empresa.
        </p>
        <ul className="mt-6 space-y-4">
          {FEATURES.map(({ icon: Icon, label, box, fill }) => (
            <li key={label} className="flex items-center gap-5">
              <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-lg", box)}>
                <Icon aria-hidden className={cn("size-7", fill && "fill-current")} strokeWidth={2.4} />
              </span>
              <span className="max-w-[8.5rem] text-[15px] font-medium leading-snug text-neutral-800">{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <div aria-hidden className="flex gap-2">
            <span className="h-1.5 w-[52px] rounded-full bg-purple-500" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
          </div>
          <p className="mt-5 max-w-[12rem] text-body-sm text-neutral-600">Uma plataforma completa para o futuro das pessoas.</p>
        </div>
      </div>
    </div>
  );
}
