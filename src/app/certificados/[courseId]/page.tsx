import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Logo, Mascot } from "@/design-system/components/brand";
import { Skeleton } from "@/design-system/components/feedback";
import { PrintButton } from "@/features/courses/print-button";
import { formatMinutes } from "@/features/courses/labels";
import { requireActor } from "@/server/dal";
import { requireModule } from "@/server/modules/flags/modules";
import { HttpError } from "@/server/http/errors";
import { getMyCertificate } from "@/server/modules/courses/service";

export const metadata: Metadata = { title: "Certificado" };

/** Certificado de conclusão — página própria (sem menus), pronta para imprimir/salvar em PDF. */
export default function CertificatePage({ params }: PageProps<"/certificados/[courseId]">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 print:bg-white print:p-0">
      <Suspense fallback={<Skeleton className="aspect-[1.414] w-full max-w-4xl rounded-xl" />}>
        <Certificate params={params} />
      </Suspense>
    </main>
  );
}

async function Certificate({ params }: { params: PageProps<"/certificados/[courseId]">["params"] }) {
  const actor = await requireActor();
  await requireModule(actor, "learning");
  const { courseId } = await params;
  if (!z.uuid().safeParse(courseId).success) notFound();
  let cert: Awaited<ReturnType<typeof getMyCertificate>>;
  try {
    cert = await getMyCertificate(actor, courseId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(cert.issuedAt));
  return (
    <div className="w-full max-w-4xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="relative aspect-[1.414] overflow-hidden rounded-xl border-[10px] border-purple-100 bg-white p-10 shadow-lg print:rounded-none print:shadow-none sm:p-14">
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-purple-50" />
        <div aria-hidden className="absolute -bottom-28 -left-20 size-80 rounded-full bg-orange-50" />
        <div className="relative flex h-full flex-col">
          <Logo className="h-14 self-start" />
          <div className="mt-auto">
            <p className="text-body font-semibold uppercase tracking-[0.25em] text-purple-600">Certificado de conclusão</p>
            <p className="mt-6 text-body text-neutral-600">Certificamos que</p>
            <h1 className="mt-1 text-[2.5rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{cert.personName}</h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-neutral-700">
              concluiu o curso <strong className="text-neutral-900">{cert.courseTitle}</strong>, com carga horária de {formatMinutes(cert.minutes)}, oferecido por {cert.organization} na Luumu People.
            </p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-6 pt-8">
            <div className="text-body-sm text-neutral-600">
              <p>Emitido em {date}</p>
              <p className="mt-1">
                Código de verificação: <span className="font-mono font-semibold tracking-wider text-neutral-900">{cert.code}</span>
              </p>
            </div>
            <Mascot className="h-24" />
          </div>
        </div>
      </article>
    </div>
  );
}
