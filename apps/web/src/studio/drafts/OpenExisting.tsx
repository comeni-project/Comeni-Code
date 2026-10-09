// Edit a node that exists (S19): find it with the learners' search, open a draft of its live
// version. A node with a draft already is said in the API's words (CA0202).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { openDraft } from "../../api/drafts";
import { draftMoved, useSearch } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { shownLevel } from "../../start/format";

export function OpenExisting() {
  const id = useId();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [words, setWords] = useState("");
  const results = useSearch(words).data?.results ?? [];
  const open = useMutation({
    mutationFn: (nodeId: string) => openDraft({ node_id: nodeId }),
    onSuccess: (draft) => {
      void draftMoved(client, draft);
      navigate(`/studio/drafts/${draft.public_id}`);
    },
  });
  return (
    <section className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface px-5 py-[18px]">
      <h2 className="text-[14.5px] font-semibold">Edit a node that exists</h2>
      <label htmlFor={id} className="sr-only">
        Find a node by name or id
      </label>
      <input
        id={id}
        type="search"
        value={words}
        onChange={(e) => setWords(e.target.value)}
        placeholder="Find a node by name or id"
        className="h-10 rounded-control border border-border-2 bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-3"
      />
      {results.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => open.mutate(node.id)}
          className="flex flex-col gap-0.5 rounded-control border border-border px-3 py-2.5 text-left hover:border-sel"
        >
          <span className="text-[14px] font-semibold">
            {node.title}{" "}
            <span className="font-mono text-[12px] font-normal text-ink-3">{node.id}</span>
          </span>
          <span className="text-[12.5px] text-ink-2">
            {node.region.name} · {shownLevel(node.level)}
          </span>
        </button>
      ))}
      {open.error !== null && <ErrorNotice error={open.error} />}
      <p className="text-[12.5px] text-ink-3">
        Opens a draft of its live version. A node has one draft at a time.
      </p>
    </section>
  );
}
