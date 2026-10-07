// S14 · Team (M4.8a spec, M4S.5): invite, the members, and the pending invites. Operators only;
// the shell's gate and the API's studio(OPERATOR) both say so.
import { useMe } from "../../api/queries";
import { InviteForm } from "./InviteForm";
import { InvitesPanel } from "./InvitesPanel";
import { MembersPanel } from "./MembersPanel";

export function TeamPage() {
  const you = useMe().data?.user?.public_id;
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Team</h1>
        <p className="text-[13.5px] text-ink-2">
          Who writes, reviews and lands content. Only operators see this page.
        </p>
      </header>
      <InviteForm />
      <MembersPanel you={you} />
      <InvitesPanel />
    </>
  );
}
