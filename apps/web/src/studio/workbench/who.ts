// Who may take a draft back (M4.5's withdraw, M4.4's discard): someone who saved it, or an operator.
import { canActAs } from "../../api/accounts";
import type { DraftOut, MeOut } from "../../api/schema";

export const mayTakeBack = (me: MeOut["user"] | undefined, draft: DraftOut): boolean =>
  me != null &&
  (canActAs(me.role, "operator") || draft.contributors.some((c) => c.public_id === me.public_id));
