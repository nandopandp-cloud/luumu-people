"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { ROLE_LABELS, SCOPE_LABELS } from "@/features/audit/labels";
import { api, ApiError } from "@/lib/api-client";

type Assignment = { id: string; roleKey: string; roleName: string; scopeType: string };
type Role = { id: string; key: string; name: string; description: string | null; defaultScope: string };

/**
 * Papéis de acesso de uma pessoa. A UI só oferece o que faz sentido; quem
 * decide é o servidor (escalonamento, autoatribuição, último admin…).
 */
export function RoleManager({ userId, assignments, roles, isSelf, orgUnits }: { userId: string; assignments: Assignment[]; roles: Role[]; isSelf: boolean; orgUnits: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [scope, setScope] = useState("");
  const [scopeOrgUnitId, setScopeOrgUnitId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = roles.find((r) => r.id === roleId);

  function grant(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await api(`/api/v1/people/${userId}/roles`, {
          method: "POST",
          body: { roleId, scopeType: scope, ...(scope === "ORG_UNIT_TREE" ? { scopeOrgUnitId } : {}) },
        });
        setOpen(false);
        setRoleId("");
        setScope("");
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível conceder o papel.");
      }
    });
  }

  function revoke(assignment: Assignment) {
    if (!window.confirm(`Remover o papel "${assignment.roleName}"? A pessoa precisará entrar novamente.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await api(`/api/v1/people/${userId}/roles/${assignment.id}`, { method: "DELETE" });
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível remover o papel.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && !open ? <Alert tone="error" title={error} /> : null}
      <ul className="divide-y divide-line">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-neutral-900">{ROLE_LABELS[a.roleKey] ?? a.roleName}</p>
              <p className="text-caption text-neutral-500">{SCOPE_LABELS[a.scopeType] ?? a.scopeType}</p>
            </div>
            {a.roleKey === "employee" ? (
              <Badge tone="neutral">Base</Badge>
            ) : isSelf ? null : (
              <IconButton label={`Remover papel ${a.roleName}`} size="sm" variant="plain" onClick={() => revoke(a)} disabled={pending}>
                <Trash2 />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      {isSelf ? (
        <p className="text-caption text-neutral-500">Por segurança, ninguém altera os próprios papéis.</p>
      ) : (
        <Modal
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setError(null);
          }}
          title="Conceder papel"
          description="A pessoa precisará entrar novamente para que as novas permissões passem a valer."
          trigger={
            <Button variant="secondary" size="sm">
              <Plus aria-hidden /> Conceder papel
            </Button>
          }
        >
          <form onSubmit={grant} className="space-y-5">
            {error ? <Alert tone="error" title={error} /> : null}
            <Field label="Papel" hint={selected?.description ?? undefined}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  required
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    setScope(roles.find((r) => r.id === e.target.value)?.defaultScope ?? "");
                  }}
                >
                  <option value="" disabled>
                    Selecione um papel
                  </option>
                  {roles
                    .filter((r) => r.key !== "employee")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {ROLE_LABELS[r.key] ?? r.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Escopo">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} required value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="" disabled>
                    Selecione o escopo
                  </option>
                  {Object.entries(SCOPE_LABELS)
                    .filter(([key]) => key !== "SELF")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            {scope === "ORG_UNIT_TREE" ? (
              <Field label="Área">
                {({ id }) => (
                  <Select id={id} required value={scopeOrgUnitId} onChange={(e) => setScopeOrgUnitId(e.target.value)}>
                    <option value="" disabled>
                      Selecione a área
                    </option>
                    {orgUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending} disabled={!roleId || !scope || (scope === "ORG_UNIT_TREE" && !scopeOrgUnitId)}>
                Conceder
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
