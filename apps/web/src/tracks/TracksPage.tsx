import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getJson } from "../api/client";
import type { NamedTrackOut } from "../api/schema";
import { ErrorNotice } from "../layout/ErrorNotice";
import { TopBar } from "../layout/TopBar";
import { withRoute } from "../url";
export function TracksPage() {
  const tracks = useQuery({
    queryKey: ["tracks"],
    queryFn: () => getJson<NamedTrackOut[]>("/api/tracks"),
    retry: false,
  });
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 p-8">
        <h1 className="text-3xl font-semibold">Tracks</h1>
        <p className="text-ink-2">Routes whose connecting text has been reviewed.</p>
        {tracks.isPending && <p>Loading tracks…</p>}
        {tracks.isError && <ErrorNotice error={tracks.error} />}
        {tracks.data?.length === 0 && (
          <p>
            No reviewed tracks yet.{" "}
            <Link to="/" className="text-sel">
              Build your own route
            </Link>
            .
          </p>
        )}
        <ul className="grid gap-4 md:grid-cols-2">
          {tracks.data?.map((track) => (
            <li key={track.public_id} className="rounded-panel border border-border bg-surface p-5">
              <Link className="font-semibold text-sel" to={withRoute("/route", track.goals, [])}>
                {track.name}
              </Link>
              <p className="mt-2 text-sm text-ink-2">{track.goals.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
