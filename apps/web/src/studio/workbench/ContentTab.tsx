// Content (S3, M4K.3): the outline beside the blocks; which editor is open is held here, so the
// outline and the rows open the same one.
import { useState } from "react";
import type { DraftNodeOut } from "../../api/schema";
import { BlockList, existing, type Opened } from "./BlockList";
import { Outline } from "./Outline";

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
  // A save finishing after another editor opened must not close the new one.
  const close = (which: Opened) => setOpened((now) => (now === which ? null : now));
  return (
    <div className="grid gap-[18px] lg:grid-cols-[200px_minmax(0,1fr)]">
      <Outline node={node} onOpen={editable ? (at) => setOpened(existing(node, at)) : null} />
      <BlockList
        draftId={draftId}
        nodeId={nodeId}
        node={node}
        editable={editable}
        opened={opened}
        open={setOpened}
        close={close}
      />
    </div>
  );
}
