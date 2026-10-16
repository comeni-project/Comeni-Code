// Links (the WorkbenchLinks board, M4K.3): the three kinds v1 has, each its own list. Only needs
// builds routes; a link names a node by its id, suggested from the landed nodes and the drafts.
import { useQueryClient } from "@tanstack/react-query";
import { useLinkTargets } from "../../api/queries";
import type { DraftNodeOut } from "../../api/schema";
import { NOTE } from "./bench";
import { LINK_TARGETS, LinkList } from "./LinkList";
import { reloadDraft } from "./useDraftEdit";

export function LinksTab({
  draftId,
  nodeId,
  node,
  editable,
}: {
  draftId: string;
  nodeId: string;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const client = useQueryClient();
  const reload = () => void reloadDraft(client, draftId);
  const common = { draftId, editable, onReload: reload };
  // Suggestions only: any id may still be typed, and verify judges it.
  // A node never links to itself (#338).
  const targets = (useLinkTargets().data ?? []).filter((t) => t.id !== nodeId);
  return (
    <>
      <datalist id={LINK_TARGETS}>
        {targets.map((t) => (
          <option key={t.id} value={t.id} label={t.draft ? `${t.title} · draft` : t.title} />
        ))}
      </datalist>
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
