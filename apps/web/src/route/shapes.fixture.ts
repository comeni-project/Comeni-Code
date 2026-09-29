// Routes of shapes Salmon does not have, as `GET /api/routes` answers them (issue 77). Captured
// from synthetic content built to stress the layout: nine lines into one goal, a deep chain over
// two regions, eight stops in one column, one region, long titles, two goals, a region that comes
// back late, and a random 50-stop graph over six regions.
//
//   uv run python <scratchpad>/make_content.py <root> && uv run python apps/api/manage.py rebuild_index --root <root>
//   curl -s "http://127.0.0.1:8090/api/routes?goal=wide-goal"
//
// The generator is recorded in the issue; these answers, not the generator, are the fixture.
import type { RouteOut } from "../api/schema";

export const WIDE: RouteOut = {
  goals: ["wide-goal"],
  known: [],
  stops: [
    {
      id: "wide-base-1",
      title: "Wide base 1",
      claim: "What wide-base-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "wide-side-1",
          title: "Wide side 1",
          level: "introductory",
          reason: "wide-side-1 builds on wide-base-1.",
        },
      ],
    },
    {
      id: "wide-side-1",
      title: "Wide side 1",
      claim: "What wide-side-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-1.",
        },
      ],
    },
    {
      id: "wide-base-2",
      title: "Wide base 2",
      claim: "What wide-base-2 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r2",
        name: "Algorithms",
      },
      needed_by: [
        {
          id: "wide-side-2",
          title: "Wide side 2",
          level: "introductory",
          reason: "wide-side-2 builds on wide-base-2.",
        },
      ],
    },
    {
      id: "wide-side-2",
      title: "Wide side 2",
      claim: "What wide-side-2 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r2",
        name: "Algorithms",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-2.",
        },
      ],
    },
    {
      id: "wide-base-3",
      title: "Wide base 3",
      claim: "What wide-base-3 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "wide-side-3",
          title: "Wide side 3",
          level: "introductory",
          reason: "wide-side-3 builds on wide-base-3.",
        },
      ],
    },
    {
      id: "wide-side-3",
      title: "Wide side 3",
      claim: "What wide-side-3 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-3.",
        },
      ],
    },
    {
      id: "wide-base-4",
      title: "Wide base 4",
      claim: "What wide-base-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "wide-side-4",
          title: "Wide side 4",
          level: "introductory",
          reason: "wide-side-4 builds on wide-base-4.",
        },
      ],
    },
    {
      id: "wide-side-4",
      title: "Wide side 4",
      claim: "What wide-side-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-4.",
        },
      ],
    },
    {
      id: "wide-base-5",
      title: "Wide base 5",
      claim: "What wide-base-5 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "wide-side-5",
          title: "Wide side 5",
          level: "introductory",
          reason: "wide-side-5 builds on wide-base-5.",
        },
      ],
    },
    {
      id: "wide-side-5",
      title: "Wide side 5",
      claim: "What wide-side-5 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-5.",
        },
      ],
    },
    {
      id: "wide-base-6",
      title: "Wide base 6",
      claim: "What wide-base-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "wide-side-6",
          title: "Wide side 6",
          level: "introductory",
          reason: "wide-side-6 builds on wide-base-6.",
        },
      ],
    },
    {
      id: "wide-side-6",
      title: "Wide side 6",
      claim: "What wide-side-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-6.",
        },
      ],
    },
    {
      id: "wide-base-7",
      title: "Wide base 7",
      claim: "What wide-base-7 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r7",
        name: "Proteins",
      },
      needed_by: [
        {
          id: "wide-side-7",
          title: "Wide side 7",
          level: "introductory",
          reason: "wide-side-7 builds on wide-base-7.",
        },
      ],
    },
    {
      id: "wide-side-7",
      title: "Wide side 7",
      claim: "What wide-side-7 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r7",
        name: "Proteins",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-7.",
        },
      ],
    },
    {
      id: "wide-base-8",
      title: "Wide base 8",
      claim: "What wide-base-8 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r8",
        name: "Imaging",
      },
      needed_by: [
        {
          id: "wide-side-8",
          title: "Wide side 8",
          level: "introductory",
          reason: "wide-side-8 builds on wide-base-8.",
        },
      ],
    },
    {
      id: "wide-side-8",
      title: "Wide side 8",
      claim: "What wide-side-8 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r8",
        name: "Imaging",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-8.",
        },
      ],
    },
    {
      id: "wide-base-9",
      title: "Wide base 9",
      claim: "What wide-base-9 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r9",
        name: "Evolution",
      },
      needed_by: [
        {
          id: "wide-side-9",
          title: "Wide side 9",
          level: "introductory",
          reason: "wide-side-9 builds on wide-base-9.",
        },
      ],
    },
    {
      id: "wide-side-9",
      title: "Wide side 9",
      claim: "What wide-side-9 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r9",
        name: "Evolution",
      },
      needed_by: [
        {
          id: "wide-goal",
          title: "Wide goal",
          level: "introductory",
          reason: "wide-goal builds on wide-side-9.",
        },
      ],
    },
    {
      id: "wide-goal",
      title: "Wide goal",
      claim: "What wide-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 190,
};

export const DEEP: RouteOut = {
  goals: ["deep-goal"],
  known: [],
  stops: [
    {
      id: "deep-1",
      title: "Deep 1",
      claim: "What deep-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-2",
          title: "Deep 2",
          level: "introductory",
          reason: "deep-2 builds on deep-1.",
        },
      ],
    },
    {
      id: "deep-2",
      title: "Deep 2",
      claim: "What deep-2 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-3",
          title: "Deep 3",
          level: "introductory",
          reason: "deep-3 builds on deep-2.",
        },
      ],
    },
    {
      id: "deep-3",
      title: "Deep 3",
      claim: "What deep-3 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-4",
          title: "Deep 4",
          level: "introductory",
          reason: "deep-4 builds on deep-3.",
        },
      ],
    },
    {
      id: "deep-4",
      title: "Deep 4",
      claim: "What deep-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-5",
          title: "Deep 5",
          level: "introductory",
          reason: "deep-5 builds on deep-4.",
        },
      ],
    },
    {
      id: "deep-5",
      title: "Deep 5",
      claim: "What deep-5 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-6",
          title: "Deep 6",
          level: "introductory",
          reason: "deep-6 builds on deep-5.",
        },
      ],
    },
    {
      id: "deep-6",
      title: "Deep 6",
      claim: "What deep-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-7",
          title: "Deep 7",
          level: "introductory",
          reason: "deep-7 builds on deep-6.",
        },
      ],
    },
    {
      id: "deep-7",
      title: "Deep 7",
      claim: "What deep-7 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-8",
          title: "Deep 8",
          level: "introductory",
          reason: "deep-8 builds on deep-7.",
        },
      ],
    },
    {
      id: "deep-8",
      title: "Deep 8",
      claim: "What deep-8 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-9",
          title: "Deep 9",
          level: "introductory",
          reason: "deep-9 builds on deep-8.",
        },
      ],
    },
    {
      id: "deep-9",
      title: "Deep 9",
      claim: "What deep-9 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-10",
          title: "Deep 10",
          level: "introductory",
          reason: "deep-10 builds on deep-9.",
        },
      ],
    },
    {
      id: "deep-10",
      title: "Deep 10",
      claim: "What deep-10 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-11",
          title: "Deep 11",
          level: "introductory",
          reason: "deep-11 builds on deep-10.",
        },
      ],
    },
    {
      id: "deep-11",
      title: "Deep 11",
      claim: "What deep-11 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-12",
          title: "Deep 12",
          level: "introductory",
          reason: "deep-12 builds on deep-11.",
        },
      ],
    },
    {
      id: "deep-12",
      title: "Deep 12",
      claim: "What deep-12 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-13",
          title: "Deep 13",
          level: "introductory",
          reason: "deep-13 builds on deep-12.",
        },
      ],
    },
    {
      id: "deep-13",
      title: "Deep 13",
      claim: "What deep-13 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-14",
          title: "Deep 14",
          level: "introductory",
          reason: "deep-14 builds on deep-13.",
        },
      ],
    },
    {
      id: "deep-14",
      title: "Deep 14",
      claim: "What deep-14 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-15",
          title: "Deep 15",
          level: "introductory",
          reason: "deep-15 builds on deep-14.",
        },
      ],
    },
    {
      id: "deep-15",
      title: "Deep 15",
      claim: "What deep-15 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "deep-16",
          title: "Deep 16",
          level: "introductory",
          reason: "deep-16 builds on deep-15.",
        },
      ],
    },
    {
      id: "deep-16",
      title: "Deep 16",
      claim: "What deep-16 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "deep-goal",
          title: "Deep goal",
          level: "introductory",
          reason: "deep-goal builds on deep-16.",
        },
      ],
    },
    {
      id: "deep-goal",
      title: "Deep goal",
      claim: "What deep-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 170,
};

export const DENSE: RouteOut = {
  goals: ["dense-goal"],
  known: [],
  stops: [
    {
      id: "dense-1",
      title: "Dense 1",
      claim: "What dense-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-1.",
        },
      ],
    },
    {
      id: "dense-2",
      title: "Dense 2",
      claim: "What dense-2 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-2.",
        },
      ],
    },
    {
      id: "dense-3",
      title: "Dense 3",
      claim: "What dense-3 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-3.",
        },
      ],
    },
    {
      id: "dense-4",
      title: "Dense 4",
      claim: "What dense-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-4.",
        },
      ],
    },
    {
      id: "dense-5",
      title: "Dense 5",
      claim: "What dense-5 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-5.",
        },
      ],
    },
    {
      id: "dense-6",
      title: "Dense 6",
      claim: "What dense-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-6.",
        },
      ],
    },
    {
      id: "dense-7",
      title: "Dense 7",
      claim: "What dense-7 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-7.",
        },
      ],
    },
    {
      id: "dense-8",
      title: "Dense 8",
      claim: "What dense-8 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "dense-goal",
          title: "Dense goal",
          level: "introductory",
          reason: "dense-goal builds on dense-8.",
        },
      ],
    },
    {
      id: "dense-goal",
      title: "Dense goal",
      claim: "What dense-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r2",
        name: "Algorithms",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 90,
};

export const SINGLE: RouteOut = {
  goals: ["single-goal"],
  known: [],
  stops: [
    {
      id: "single-a",
      title: "Single a",
      claim: "What single-a says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "single-b",
          title: "Single b",
          level: "introductory",
          reason: "single-b builds on single-a.",
        },
        {
          id: "single-c",
          title: "Single c",
          level: "introductory",
          reason: "single-c builds on single-a.",
        },
      ],
    },
    {
      id: "single-b",
      title: "Single b",
      claim: "What single-b says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "single-goal",
          title: "Single goal",
          level: "introductory",
          reason: "single-goal builds on single-b.",
        },
      ],
    },
    {
      id: "single-c",
      title: "Single c",
      claim: "What single-c says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "single-goal",
          title: "Single goal",
          level: "introductory",
          reason: "single-goal builds on single-c.",
        },
      ],
    },
    {
      id: "single-goal",
      title: "Single goal",
      claim: "What single-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 40,
};

export const LONG: RouteOut = {
  goals: ["long-goal"],
  known: [],
  stops: [
    {
      id: "long-a",
      title: "A very long title that keeps on going well past what any label was drawn for",
      claim: "What long-a says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "long-b",
          title: "A very long title that keeps on going well past what any label was dra",
          level: "introductory",
          reason: "long-b builds on long-a.",
        },
        {
          id: "long-c",
          title: "A very long title that keeps on going well past what any lab",
          level: "introductory",
          reason: "long-c builds on long-a.",
        },
      ],
    },
    {
      id: "long-b",
      title: "A very long title that keeps on going well past what any label was dra",
      claim: "What long-b says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "long-goal",
          title: "A very long title that keeps on going well past what any label was drawn fo",
          level: "introductory",
          reason: "long-goal builds on long-b.",
        },
      ],
    },
    {
      id: "long-c",
      title: "A very long title that keeps on going well past what any lab",
      claim: "What long-c says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r7",
        name: "Proteins",
      },
      needed_by: [
        {
          id: "long-goal",
          title: "A very long title that keeps on going well past what any label was drawn fo",
          level: "introductory",
          reason: "long-goal builds on long-c.",
        },
      ],
    },
    {
      id: "long-goal",
      title: "A very long title that keeps on going well past what any label was drawn fo",
      claim: "What long-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 40,
};

export const TWIN: RouteOut = {
  goals: ["twin-a", "twin-b"],
  known: [],
  stops: [
    {
      id: "twin-base",
      title: "Twin base",
      claim: "What twin-base says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r8",
        name: "Imaging",
      },
      needed_by: [
        {
          id: "twin-a",
          title: "Twin a",
          level: "introductory",
          reason: "twin-a builds on twin-base.",
        },
        {
          id: "twin-b",
          title: "Twin b",
          level: "introductory",
          reason: "twin-b builds on twin-base.",
        },
      ],
    },
    {
      id: "twin-a",
      title: "Twin a",
      claim: "What twin-a says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r8",
        name: "Imaging",
      },
      needed_by: [],
    },
    {
      id: "twin-b",
      title: "Twin b",
      claim: "What twin-b says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r9",
        name: "Evolution",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 30,
};

export const LATE: RouteOut = {
  goals: ["late-goal"],
  known: [],
  stops: [
    {
      id: "late-early",
      title: "Late early",
      claim: "What late-early says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "late-again",
          title: "Late again",
          level: "introductory",
          reason: "late-again builds on late-early.",
        },
      ],
    },
    {
      id: "late-mid-1",
      title: "Late mid 1",
      claim: "What late-mid-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-mid-2",
          title: "Late mid 2",
          level: "introductory",
          reason: "late-mid-2 builds on late-mid-1.",
        },
      ],
    },
    {
      id: "late-mid-2",
      title: "Late mid 2",
      claim: "What late-mid-2 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-mid-3",
          title: "Late mid 3",
          level: "introductory",
          reason: "late-mid-3 builds on late-mid-2.",
        },
      ],
    },
    {
      id: "late-mid-3",
      title: "Late mid 3",
      claim: "What late-mid-3 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-mid-4",
          title: "Late mid 4",
          level: "introductory",
          reason: "late-mid-4 builds on late-mid-3.",
        },
      ],
    },
    {
      id: "late-mid-4",
      title: "Late mid 4",
      claim: "What late-mid-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-mid-5",
          title: "Late mid 5",
          level: "introductory",
          reason: "late-mid-5 builds on late-mid-4.",
        },
      ],
    },
    {
      id: "late-mid-5",
      title: "Late mid 5",
      claim: "What late-mid-5 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-mid-6",
          title: "Late mid 6",
          level: "introductory",
          reason: "late-mid-6 builds on late-mid-5.",
        },
      ],
    },
    {
      id: "late-mid-6",
      title: "Late mid 6",
      claim: "What late-mid-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r6",
        name: "Ecology",
      },
      needed_by: [
        {
          id: "late-again",
          title: "Late again",
          level: "introductory",
          reason: "late-again builds on late-mid-6.",
        },
      ],
    },
    {
      id: "late-again",
      title: "Late again",
      claim: "What late-again says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "late-goal",
          title: "Late goal",
          level: "introductory",
          reason: "late-goal builds on late-again.",
        },
      ],
    },
    {
      id: "late-goal",
      title: "Late goal",
      claim: "What late-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r7",
        name: "Proteins",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 90,
};

export const BIG: RouteOut = {
  goals: ["big-goal"],
  known: [],
  stops: [
    {
      id: "big-23",
      title: "Big 23",
      claim: "What big-23 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "big-28",
          title: "Big 28",
          level: "introductory",
          reason: "big-28 builds on big-23.",
        },
      ],
    },
    {
      id: "big-19",
      title: "Big 19",
      claim: "What big-19 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-22",
          title: "Big 22",
          level: "introductory",
          reason: "big-22 builds on big-19.",
        },
        {
          id: "big-25",
          title: "Big 25",
          level: "introductory",
          reason: "big-25 builds on big-19.",
        },
      ],
    },
    {
      id: "big-6",
      title: "Big 6",
      claim: "What big-6 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-9",
          title: "Big 9",
          level: "introductory",
          reason: "big-9 builds on big-6.",
        },
        {
          id: "big-13",
          title: "Big 13",
          level: "introductory",
          reason: "big-13 builds on big-6.",
        },
      ],
    },
    {
      id: "big-0",
      title: "Big 0",
      claim: "What big-0 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r2",
        name: "Algorithms",
      },
      needed_by: [
        {
          id: "big-9",
          title: "Big 9",
          level: "introductory",
          reason: "big-9 builds on big-0.",
        },
        {
          id: "big-4",
          title: "Big 4",
          level: "introductory",
          reason: "big-4 builds on big-0.",
        },
      ],
    },
    {
      id: "big-22",
      title: "Big 22",
      claim: "What big-22 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-34",
          title: "Big 34",
          level: "introductory",
          reason: "big-34 builds on big-22.",
        },
      ],
    },
    {
      id: "big-1",
      title: "Big 1",
      claim: "What big-1 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-9",
          title: "Big 9",
          level: "introductory",
          reason: "big-9 builds on big-1.",
        },
        {
          id: "big-11",
          title: "Big 11",
          level: "introductory",
          reason: "big-11 builds on big-1.",
        },
      ],
    },
    {
      id: "big-37",
      title: "Big 37",
      claim: "What big-37 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-47",
          title: "Big 47",
          level: "introductory",
          reason: "big-47 builds on big-37.",
        },
      ],
    },
    {
      id: "big-9",
      title: "Big 9",
      claim: "What big-9 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-11",
          title: "Big 11",
          level: "introductory",
          reason: "big-11 builds on big-9.",
        },
      ],
    },
    {
      id: "big-4",
      title: "Big 4",
      claim: "What big-4 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-11",
          title: "Big 11",
          level: "introductory",
          reason: "big-11 builds on big-4.",
        },
        {
          id: "big-13",
          title: "Big 13",
          level: "introductory",
          reason: "big-13 builds on big-4.",
        },
      ],
    },
    {
      id: "big-11",
      title: "Big 11",
      claim: "What big-11 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-16",
          title: "Big 16",
          level: "introductory",
          reason: "big-16 builds on big-11.",
        },
        {
          id: "big-13",
          title: "Big 13",
          level: "introductory",
          reason: "big-13 builds on big-11.",
        },
      ],
    },
    {
      id: "big-16",
      title: "Big 16",
      claim: "What big-16 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-20",
          title: "Big 20",
          level: "introductory",
          reason: "big-20 builds on big-16.",
        },
      ],
    },
    {
      id: "big-13",
      title: "Big 13",
      claim: "What big-13 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-25",
          title: "Big 25",
          level: "introductory",
          reason: "big-25 builds on big-13.",
        },
      ],
    },
    {
      id: "big-25",
      title: "Big 25",
      claim: "What big-25 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-35",
          title: "Big 35",
          level: "introductory",
          reason: "big-35 builds on big-25.",
        },
        {
          id: "big-28",
          title: "Big 28",
          level: "introductory",
          reason: "big-28 builds on big-25.",
        },
        {
          id: "big-27",
          title: "Big 27",
          level: "introductory",
          reason: "big-27 builds on big-25.",
        },
        {
          id: "big-33",
          title: "Big 33",
          level: "introductory",
          reason: "big-33 builds on big-25.",
        },
      ],
    },
    {
      id: "big-35",
      title: "Big 35",
      claim: "What big-35 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-45",
          title: "Big 45",
          level: "introductory",
          reason: "big-45 builds on big-35.",
        },
      ],
    },
    {
      id: "big-45",
      title: "Big 45",
      claim: "What big-45 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "big-47",
          title: "Big 47",
          level: "introductory",
          reason: "big-47 builds on big-45.",
        },
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-45.",
        },
      ],
    },
    {
      id: "big-20",
      title: "Big 20",
      claim: "What big-20 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-27",
          title: "Big 27",
          level: "introductory",
          reason: "big-27 builds on big-20.",
        },
      ],
    },
    {
      id: "big-28",
      title: "Big 28",
      claim: "What big-28 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-38",
          title: "Big 38",
          level: "introductory",
          reason: "big-38 builds on big-28.",
        },
      ],
    },
    {
      id: "big-38",
      title: "Big 38",
      claim: "What big-38 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-42",
          title: "Big 42",
          level: "introductory",
          reason: "big-42 builds on big-38.",
        },
      ],
    },
    {
      id: "big-34",
      title: "Big 34",
      claim: "What big-34 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "big-46",
          title: "Big 46",
          level: "introductory",
          reason: "big-46 builds on big-34.",
        },
        {
          id: "big-42",
          title: "Big 42",
          level: "introductory",
          reason: "big-42 builds on big-34.",
        },
        {
          id: "big-44",
          title: "Big 44",
          level: "introductory",
          reason: "big-44 builds on big-34.",
        },
      ],
    },
    {
      id: "big-46",
      title: "Big 46",
      claim: "What big-46 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-49",
          title: "Big 49",
          level: "introductory",
          reason: "big-49 builds on big-46.",
        },
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-46.",
        },
      ],
    },
    {
      id: "big-42",
      title: "Big 42",
      claim: "What big-42 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r1",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "big-48",
          title: "Big 48",
          level: "introductory",
          reason: "big-48 builds on big-42.",
        },
      ],
    },
    {
      id: "big-48",
      title: "Big 48",
      claim: "What big-48 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-48.",
        },
      ],
    },
    {
      id: "big-44",
      title: "Big 44",
      claim: "What big-44 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-44.",
        },
      ],
    },
    {
      id: "big-49",
      title: "Big 49",
      claim: "What big-49 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-49.",
        },
      ],
    },
    {
      id: "big-26",
      title: "Big 26",
      claim: "What big-26 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "big-27",
          title: "Big 27",
          level: "introductory",
          reason: "big-27 builds on big-26.",
        },
      ],
    },
    {
      id: "big-27",
      title: "Big 27",
      claim: "What big-27 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-33",
          title: "Big 33",
          level: "introductory",
          reason: "big-33 builds on big-27.",
        },
      ],
    },
    {
      id: "big-33",
      title: "Big 33",
      claim: "What big-33 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r4",
        name: "Physics",
      },
      needed_by: [
        {
          id: "big-39",
          title: "Big 39",
          level: "introductory",
          reason: "big-39 builds on big-33.",
        },
      ],
    },
    {
      id: "big-39",
      title: "Big 39",
      claim: "What big-39 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r5",
        name: "Programming",
      },
      needed_by: [
        {
          id: "big-47",
          title: "Big 47",
          level: "introductory",
          reason: "big-47 builds on big-39.",
        },
      ],
    },
    {
      id: "big-47",
      title: "Big 47",
      claim: "What big-47 says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r3",
        name: "Chemistry",
      },
      needed_by: [
        {
          id: "big-goal",
          title: "Big goal",
          level: "introductory",
          reason: "big-goal builds on big-47.",
        },
      ],
    },
    {
      id: "big-goal",
      title: "Big goal",
      claim: "What big-goal says, in one sentence.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "r0",
        name: "Genomics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "introductory",
    highest: "introductory",
  },
  minutes: 300,
};

export const SHAPES = { WIDE, DEEP, DENSE, SINGLE, LONG, TWIN, LATE, BIG };
