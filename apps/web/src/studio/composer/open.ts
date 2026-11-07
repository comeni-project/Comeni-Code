// Where the composer is, and going there from an editor (M6.5 spec, M6CO.1): what the editor
// holds is saved first, and the page moves once the saves land; a refused save stays put, with
// the editor open and its problem.
import { useNavigate } from "react-router";
import { useAfterSaves } from "../workbench/useDraftEdit";

export function composerPath(
  draftId: string,
  stem: string | null,
  place: { block?: number; at?: number; question?: string } = {},
): string {
  const query =
    place.block !== undefined
      ? `?block=${place.block}`
      : place.at !== undefined
        ? `?at=${place.at}`
        : place.question !== undefined
          ? `?for=${encodeURIComponent(place.question)}`
          : "";
  return `/studio/drafts/${draftId}/figures/${stem ?? "new"}${query}`;
}

export function useOpenComposer(draftId: string) {
  const navigate = useNavigate();
  const after = useAfterSaves(draftId);
  return (path: string, save?: () => void) => {
    save?.();
    after(() => navigate(path));
  };
}
