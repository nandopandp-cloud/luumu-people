"use client";

import { useState } from "react";
import { Avatar, AvatarGroup } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Logo } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { AreaChart, ColumnChart, DonutChart } from "@/design-system/components/charts";
import { Checkbox, RadioGroup, Switch } from "@/design-system/components/choice";
import { Combobox } from "@/design-system/components/combobox";
import { DataTable } from "@/design-system/components/data-table";
import { DatePicker } from "@/design-system/components/date-picker";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { FileUpload, type UploadItem } from "@/design-system/components/file-upload";
import { NotificationBell, type NotificationItem } from "@/design-system/components/notification";
import { CircularProgress, Progress } from "@/design-system/components/progress";
import { useToast } from "@/design-system/components/toast";

/* Exemplos ilustrativos da vitrine — não são dados do produto. */
const TOPICS = ["Liderança", "Inovação", "Comunicação", "Gestão do Tempo", "Cultura e Pessoas"].map((t) => ({ value: t, label: t }));
const PEOPLE = [
  { value: "1", label: "Pessoa Exemplo A", description: "Produto" },
  { value: "2", label: "Pessoa Exemplo B", description: "Design" },
  { value: "3", label: "Pessoa Exemplo C", description: "Gente e Gestão" },
].map((p) => ({ ...p, avatar: { name: p.label } }));
const SERIES = ["10/09", "11/09", "12/09", "13/09", "14/09", "15/09", "16/09"].map((label, i) => ({ label, value: [9, 12, 11, 16, 14, 19, 23][i]! * 1000 }));
const ROWS = Array.from({ length: 14 }, (_, i) => ({ id: String(i), name: `Curso exemplo ${i + 1}`, area: ["Produto", "Design", "Engenharia"][i % 3]!, progress: (i * 37) % 101 }));
const NOTIFICATIONS: NotificationItem[] = [
  { id: "1", kind: "deadline", title: "Prazo se aproximando", description: "Curso exemplo termina em 3 dias", time: "há 10 min", unread: true },
  { id: "2", kind: "announcement", title: "Novo comunicado", description: "Comunicado de exemplo", time: "há 1 h", unread: true },
  { id: "3", kind: "achievement", title: "Nova conquista", description: "Selo de exemplo", time: "ontem" },
];

export function Showcase() {
  const toast = useToast();
  const [topics, setTopics] = useState<string[]>(["Liderança", "Inovação"]);
  const [person, setPerson] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>("2026-03-12");
  const [uploads, setUploads] = useState<UploadItem[]>([
    { id: "a", name: "apresentacao.pdf", size: 2_400_000, status: "uploading", progress: 60 },
    { id: "b", name: "relatorio.pdf", size: 1_200_000, status: "done" },
    { id: "c", name: "planilha.pdf", size: 900_000, status: "error" },
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo className="h-14" />
        <div className="flex items-center gap-3">
          <Badge tone="orange">Somente fora de produção</Badge>
          <NotificationBell items={NOTIFICATIONS} onMarkAllRead={() => toast({ tone: "success", title: "Tudo lido!" })} />
        </div>
      </header>
      <h1 className="text-h1 font-extrabold text-neutral-900">Design system · Luumu People</h1>

      <Card>
        <CardHeader title="Botões e toasts" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => toast({ tone: "success", title: "Operação realizada com sucesso!" })}>Toast de sucesso</Button>
          <Button variant="secondary" onClick={() => toast({ tone: "info", title: "Atenção!", description: "Revise as informações antes de continuar." })}>Toast informativo</Button>
          <Button variant="soft" onClick={() => toast({ tone: "warning", title: "Seu acesso expira em 3 dias." })}>Toast de aviso</Button>
          <Button variant="destructive" onClick={() => toast({ tone: "error", title: "Não foi possível concluir a ação.", description: "Tente novamente em alguns instantes." })}>Toast de erro</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="tertiary">Terciário</Button>
          <Button loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Campos e seleção" />
          <div className="space-y-5">
            <Field label="Seu e-mail" hint="Usamos para avisos importantes.">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="voce@empresa.com" />}
            </Field>
            <Field label="Temas de interesse">
              {({ id, describedBy }) => <Combobox id={id} aria-describedby={describedBy} multiple options={TOPICS} value={topics} onChange={setTopics} placeholder="Selecione os temas" />}
            </Field>
            <Field label="Pessoa responsável">
              {({ id, describedBy }) => <Combobox id={id} aria-describedby={describedBy} options={PEOPLE} value={person} onChange={setPerson} placeholder="Selecione uma pessoa" searchPlaceholder="Buscar pessoa…" />}
            </Field>
            <Field label="Data de início">
              {({ id, describedBy }) => <DatePicker id={id} aria-describedby={describedBy} value={date} onChange={setDate} />}
            </Field>
            <div className="flex flex-wrap gap-6">
              <Switch label="Ativado" defaultChecked />
              <Checkbox label="Selecionado" defaultChecked />
              <RadioGroup defaultValue="a" options={[{ value: "a", label: "Opção A" }, { value: "b", label: "Opção B" }]} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Upload de arquivo" />
          <FileUpload
            items={uploads}
            accept=".pdf,.png,.jpg"
            hint="PNG, JPG ou PDF até 10 MB"
            multiple
            onSelect={(files) => setUploads((u) => [...u, ...files.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, status: "selected" as const }))])}
            onRemove={(id) => setUploads((u) => u.filter((x) => x.id !== id))}
            onRetry={(id) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "uploading", progress: 10 } : x)))}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <AreaChart title="Acessos na semana" description="Exemplo de série temporal" data={SERIES} />
        </Card>
        <Card>
          <DonutChart
            title="Distribuição por perfil"
            centerLabel={{ value: "100", caption: "pessoas" }}
            data={[
              { label: "Colaboradores", value: 58 },
              { label: "Gestores", value: 18 },
              { label: "Editores", value: 12 },
              { label: "G&G", value: 8 },
              { label: "Administradores", value: 4 },
            ]}
          />
        </Card>
        <Card>
          <ColumnChart title="Horas de aprendizado" valueSuffix="h" data={["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"].map((label, i) => ({ label, value: [4, 6, 5, 7, 10, 12][i]! }))} />
        </Card>
        <Card>
          <CardHeader title="Progresso e avatares" />
          <div className="flex items-center gap-6">
            <CircularProgress value={72} label="Progresso de exemplo" />
            <div className="flex-1 space-y-3">
              <Progress value={60} label="Exemplo 1" />
              <Progress value={30} label="Exemplo 2" tone="green" />
              <AvatarGroup people={[{ name: "Ana Exemplo" }, { name: "Bruno Exemplo" }, { name: "Carla Exemplo" }, { name: "Davi Exemplo" }, { name: "Eva Exemplo" }]} />
              <Avatar name="Fulano Exemplo" size="lg" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Tabela de dados" />
        <DataTable
          caption="Cursos de exemplo"
          rows={ROWS}
          rowKey={(r) => r.id}
          pageSize={5}
          columns={[
            { key: "name", header: "Curso", cell: (r) => <span className="font-medium text-neutral-900">{r.name}</span>, sortValue: (r) => r.name },
            { key: "area", header: "Área", cell: (r) => r.area, sortValue: (r) => r.area },
            { key: "progress", header: "Progresso", align: "right", cell: (r) => `${r.progress}%`, sortValue: (r) => r.progress },
          ]}
        />
      </Card>

      <Alert tone="info" title="Esta página não existe em produção.">
        Use-a para revisar componentes; dados aqui são apenas ilustrativos.
      </Alert>
    </main>
  );
}
