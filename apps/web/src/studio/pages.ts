// Studio's pages, as data (M4S.4): the rail draws the ones a role can open, and the shell's gate
// checks the same entry, so a page is added here and nowhere else. M4.8b adds the drafts.
import { canActAs, type Role } from "../api/accounts";

export interface StudioPage {
  path: string;
  label: string;
  /** The rail icon's path, on the boards' 16×16 grid. */
  icon: string;
  minRole: Role;
  /** The rail's top groups, or its foot (AI, Library, Team on the boards). */
  place: "top" | "foot";
}

export const STUDIO_PAGES: readonly StudioPage[] = [
  {
    path: "/studio/team",
    label: "Team",
    icon: "M6 7a2.3 2.3 0 1 0 0-.01M1.8 13.5c.6-2.3 2.2-3.5 4.2-3.5s3.6 1.2 4.2 3.5M11 6.5a2 2 0 1 0 0-.01M11.5 9.8c1.4.2 2.4 1.3 2.8 3.2",
    minRole: "operator",
    place: "foot",
  },
];

export const pageAt = (pathname: string): StudioPage | undefined =>
  STUDIO_PAGES.find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`));

export const pagesFor = (role: string): StudioPage[] =>
  STUDIO_PAGES.filter((page) => canActAs(role, page.minRole));
