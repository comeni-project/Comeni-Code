// Main and the index (M4.9c spec, M4LS.3); filled in Task 6.
import { useStudioIndex } from "../../api/queries";

export function IndexCard() {
  useStudioIndex();
  return null;
}
