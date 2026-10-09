// Content (S3, M4K.3): the outline beside the blocks; which editor is open is held here, so the
// outline and the rows open the same one, after any save in flight.
import { useState } from "react";
import type { DraftNodeOut } from "../../api/schema";
import { BlockList, existing, type Opened } from "./BlockList";
import { Outline } from "./Outline";
import { follow, useAfterSaves } from "./useDraftEdit";

export function ContentTab({
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
  const [opened, setOpened] = useState<Opened | null>(null);
  const after = useAfterSaves(draftId);
  // Opening waits for a save in flight, then opens what was chosen where it now is (#255).
  const open = (at: number, make: (node: DraftNodeOut, at: number) => Opened) =>
    after((draft, landed) => {
      const place = follow(at, landed);
      if (place !== null && draft.node !== null) setOpened(make(draft.node, place));
    });
  // A save finishing after another editor opened must not close the new one.
  const close = (which: Opened) => setOpened((now) => (now === which ? null : now));
  return (
    <div className="grid gap-[18px] lg:grid-cols-[200px_minmax(0,1fr)]">
      <Outline node={node} onOpen={editable ? (at) => open(at, existing) : null} />
      <BlockList
        draftId={draftId}
        nodeId={nodeId}
        node={node}
        editable={editable}
        opened={opened}
        open={open}
        close={close}
      />
    </div>
  );
}
