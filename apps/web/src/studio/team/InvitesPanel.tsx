// Pending invites (S14): who, as what, until when, and Withdraw.
import { useMutation } from "@tanstack/react-query";
import { ROLE_LABEL, type Role, withdrawInvite } from "../../api/accounts";
import { useInvites, useTeamChange } from "../../api/queries";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";

const CELL = "px-[18px] py-3 text-left text-[13.5px]";

export function InvitesPanel() {
  const invites = useInvites();
  const changed = useTeamChange();
  const withdraw = useMutation({ mutationFn: withdrawInvite, onSettled: changed });
  const pending = invites.data ?? [];
  return (
    <section className="flex flex-col gap-3">
      {withdraw.error !== null && <ErrorNotice error={withdraw.error} />}
      <div className="overflow-x-auto rounded-panel border border-border bg-surface">
        <div className="flex justify-between px-[18px] py-3.5">
          <h2 className="text-[14.5px] font-semibold">Pending invites</h2>
          <span className="text-[12.5px] text-ink-3">{invites.data?.length ?? ""}</span>
        </div>
        {invites.isError && <ErrorNotice error={invites.error} />}
        {pending.length > 0 && (
          <table className="w-full border-collapse">
            <tbody>
              {pending.map((invite) => (
                <tr key={invite.public_id} className="border-t border-border">
                  <td className={CELL}>{invite.email}</td>
                  <td className={`${CELL} text-ink-2`}>
                    {ROLE_LABEL[invite.role as Role] ?? invite.role}
                  </td>
                  <td className={`${CELL} text-ink-2`}>Expires {invite.expires_at.slice(0, 10)}</td>
                  <td className={CELL}>
                    <button
                      type="button"
                      className={SECONDARY}
                      onClick={() => withdraw.mutate(invite.public_id)}
                    >
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
