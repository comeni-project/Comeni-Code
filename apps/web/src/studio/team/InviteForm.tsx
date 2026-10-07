// Invite someone (S14): an address and a role; the API mails a one-use link for 7 days.
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "../../account/Field";
import { type Role, sendInvite } from "../../api/accounts";
import { useTeamChange } from "../../api/queries";
import { PRIMARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { RoleSwitch } from "./RoleSwitch";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");
  const changed = useTeamChange();
  const send = useMutation({
    mutationFn: () => sendInvite(email, role),
    onSuccess: async () => {
      setEmail("");
      await changed();
    },
  });
  return (
    <form
      className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface px-5 py-[18px]"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <h2 className="text-[14.5px] font-semibold">Invite someone</h2>
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Role</span>
          <RoleSwitch label="Role for the invite" value={role} onChange={setRole} />
        </div>
        <button type="submit" className={PRIMARY} disabled={send.isPending}>
          Send invite
        </button>
      </div>
      {send.error !== null && <ErrorNotice error={send.error} />}
      <p className="text-[12.5px] text-ink-3">
        They get a link that works once, for 7 days. Authors write; reviewers also approve;
        operators also land and manage the team.
      </p>
    </form>
  );
}
