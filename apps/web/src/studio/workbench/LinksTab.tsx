// Links (the WorkbenchLinks board, M4K.3): the three kinds v1 has, each its own list. Only needs
// builds routes; a link names a node by its id.
import { useQueryClient } from "@tanstack/react-query";
import type { DraftNodeOut } from "../../api/schema";
import { NOTE } from "./bench";
import { LinkList } from "./LinkList";
import { reloadDraft } from "./useDraftEdit";

export function LinksTab({
  draftId,
  node,
  editable,
}: {
  draftId: string;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const client = useQueryClient();
  const reload = () => void reloadDraft(client, draftId);
  const common = { draftId, editable, onReload: reload };
  return (
    <>
      <p className={NOTE}>
        Each list saves when you leave it. Only <b className="font-semibold text-ink">needs</b>{" "}
        builds routes; a link names a node by its id.
      </p>
      <LinkList
        {...common}
        kind="needs"
        title="Needs"
        sub="what understanding this node requires"
        saved={node.needs}
      />
      <LinkList
        {...common}
        kind="goes_deeper"
        title="Goes deeper"
        sub="where a curious learner goes next"
        saved={node.goes_deeper}
      />
      <LinkList
        {...common}
        kind="related"
        title="Related"
        sub="what a learner might read instead"
        saved={node.related}
        after="At most four."
      />
    </>
  );
}
