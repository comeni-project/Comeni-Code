// Members (S14): a role switch per member, and deactivating after one confirmation in the row
// (M4S.5). A refusal (CA0108) shows above the table; the switch keeps showing the stored role.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { changeRole, deactivate, type Role } from "../../api/accounts";
import { useMembers, useTeamChange } from "../../api/queries";
import type { TeamMemberOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { RoleSwitch } from "./RoleSwitch";

const CELL = "px-[18px] py-3 text-left text-[13.5px]";
const HEAD = "px-[18px] py-2 text-left text-[12px] font-medium text-ink-3";

function Status({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-pill bg-line-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-btn">
      Active
    </span>
  ) : (
    <span className="rounded-pill border border-border-2 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-2">
      Deactivated
    </span>
  );
}

export function MembersPanel({ you }: { you: string | undefined }) {
  const members = useMembers();
  const changed = useTeamChange();
  const [confirming, setConfirming] = useState<string | null>(null);
  const role = useMutation({
    mutationFn: ({ id, to }: { id: string; to: Role }) => changeRole(id, to),
    onSettled: changed,
  });
  const off = useMutation({
    mutationFn: (id: string) => deactivate(id),
    onSettled: async () => {
      setConfirming(null);
      await changed();
    },
  });
  const refusal = role.error ?? off.error;

  function actions(member: TeamMemberOut) {
    if (member.public_id === you) return <span className="text-ink-3">you</span>;
    if (!member.active) return null;
    if (confirming !== member.public_id) {
      return (
        <button type="button" className={SECONDARY} onClick={() => setConfirming(member.public_id)}>
          Deactivate
        </button>
      );
    }
    return (
      <span className="flex items-center gap-2">
        <span className="text-[13px]">Deactivate {member.name || member.email}?</span>
        <button type="button" className={SECONDARY} onClick={() => off.mutate(member.public_id)}>
          Confirm
        </button>
        <button type="button" className={SECONDARY} onClick={() => setConfirming(null)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {refusal !== null && <ErrorNotice error={refusal} />}
      <div className="overflow-x-auto rounded-panel border border-border bg-surface">
        <div className="flex justify-between px-[18px] py-3.5">
          <h2 className="text-[14.5px] font-semibold">Members</h2>
          <span className="text-[12.5px] text-ink-3">{members.data?.length ?? ""}</span>
        </div>
        {members.isError && <ErrorNotice error={members.error} />}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-border">
              <th className={HEAD}>Name</th>
              <th className={HEAD}>Email</th>
              <th className={HEAD}>Role</th>
              <th className={HEAD}>Status</th>
              <th className={HEAD}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).map((member) => (
              <tr key={member.public_id} className="border-t border-border">
                <td className={`${CELL} font-medium`}>{member.name}</td>
                <td className={`${CELL} text-ink-2`}>{member.email}</td>
                <td className={CELL}>
                  <RoleSwitch
                    label={`Role for ${member.email}`}
                    value={member.role}
                    onChange={(to) => role.mutate({ id: member.public_id, to })}
                    disabled={role.isPending}
                  />
                </td>
                <td className={CELL}>
                  <Status active={member.active} />
                </td>
                <td className={CELL}>{actions(member)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
