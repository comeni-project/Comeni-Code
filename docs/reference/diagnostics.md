# Diagnostic codes

Every problem Comeni Code reports carries a code: `CS` from code-schema, `CW` from
code-weaver, `CA` from the API, grouped in bands of one hundred by concern. A code is
never renumbered. `uv run code-schema explain <CODE>` prints one entry.

*Generated from `packages/code-schema/src/code_schema/diagnostics.yml` — do not edit. Regenerate with `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.*

## CS — code-schema: the content format

### CS0001–CS0099 · fields

#### CS0001 — the file is not valid YAML

*Refuses.*

**Fix.** Correct the YAML at the line given; the message quotes what the parser expected.

**Why.** node.yaml, regions.yaml and providers.yaml are read as YAML before anything else, so nothing in the file can be checked until it parses (M1P1.3).

#### CS0002 — a YAML file is empty

*Refuses.*

**Fix.** Write the file's fields, or remove the folder if it is not meant to be a node.

**Why.** An empty node.yaml has none of the required fields, so it is reported once as empty rather than once per missing field (M1P1.3).

#### CS0003 — a YAML file is not a mapping of fields

*Refuses.*

**Fix.** Write the file as `field: value` lines at the top level, not a list or a single value.

**Why.** Every file the format reads is a mapping of named fields; a list or a bare value at the top has no names to check (M1P1.3).

#### CS0004 — a field this format does not have

*Refuses.*

**Fix.** Remove the field, or correct its name to the one suggested. `helps` and link groups are designed but not accepted until content needs them (W3.2).

**Why.** The field set is closed: an unknown field is almost always a typo, and a typo left silent is a field the app never reads (M1P1.3). The closest known name is offered when there is one.

#### CS0005 — a required field is missing

*Refuses.*

**Fix.** Add the field named in the problem to node.yaml.

**Why.** Every node carries schema, title, claim, region, level and minutes (M1P1.3): the route, the page and the index all read them.

#### CS0006 — the node's schema version is not this validator's

*Refuses.*

**Fix.** Write `schema: 1`, or validate with the version of code-schema the node was written for.

**Why.** A node says which version of the format it follows, so a validator never guesses at a file written for a later one (M1P1.3).

#### CS0007 — a value that must be text is not

*Refuses.*

**Fix.** Write the value as text; quote it if YAML reads it as a number, a date or true/false.

**Why.** Nothing is coerced: "12" and 12 are different values, and a coerced value means the file and the object disagree, so the writer would rewrite the file (M1P1.3).

#### CS0008 — a text value is empty

*Refuses.*

**Fix.** Write the value, or leave out the field if it is optional.

**Why.** An empty title, claim, reason or hint reaches a learner as a blank; a field that is present must say something (M1P1.3).

#### CS0009 — a one-line value has a line break

*Refuses.*

**Fix.** Join the value into one line.

**Why.** Titles, claims, reasons, hints and options are drawn as one line on the page; a line break would be lost or break the layout (M1P1.3).

#### CS0010 — a text value is over its length

*Refuses.*

**Fix.** Shorten the value to the length the message gives.

**Why.** Each field has a length that fits where it is drawn — a title in a map label, a claim in a card (M1P1.3). The limit lives in the validator, not in the database's columns (M1P5).

#### CS0011 — a sentence does not end as one

*Refuses.*

**Fix.** End the value with a full stop, a question mark or an exclamation mark.

**Why.** A claim, a reason, an ask or a hint is read as a sentence; ending it as one is the check the validator can keep, where counting sentences is not (M1P1.3).

#### CS0012 — a value is not one of the listed choices

*Refuses.*

**Fix.** Use one of the values the message lists.

**Why.** Levels, kinds, displays and the like are closed vocabularies: the page and the weaver know exactly these values and no others (M1P1.3, M3P1.2).

#### CS0013 — a value that must be a whole number is not

*Refuses.*

**Fix.** Write a whole number without quotes or decimals.

**Why.** Minutes and similar counts are whole numbers; a route's total time is their sum (M1P1.3).

#### CS0014 — a number is below its minimum

*Refuses.*

**Fix.** Write a number at least as large as the minimum the message gives.

**Why.** A node takes at least a minute; zero or less would make a route's time wrong (M1P1.3).

#### CS0015 — an id is not lower case, digits and single hyphens

*Refuses.*

**Fix.** Rename the id, or the node's folder, to lower case letters, digits and single hyphens.

**Why.** Ids appear in URLs, links and file names, so they take one safe form everywhere (M1P1.2). A node's id is its folder's name.

#### CS0016 — a value is not in the registry that lists them

*Refuses.*

**Fix.** Use a value the registry lists — the closest is suggested — or add it to the registry in a pull request of its own.

**Why.** A node's region comes from regions.yaml, so regions are decided once and every node agrees on them (M1P1.3).

#### CS0017 — a value is not a url

*Refuses.*

**Fix.** Write the full address, starting https://, with no spaces.

**Why.** Resources point outward, so their address must be one a learner's browser can open (M3P1.2).

#### CS0018 — a url is not https

*Refuses.*

**Fix.** Write the https:// address of the same page.

**Why.** Plain http is refused rather than upgraded: nothing in the format coerces a value (M3P1.2).

#### CS0019 — an optional list is written empty

*Refuses.*

**Fix.** Remove the field; an absent list means none.

**Why.** An optional list is written only when it has entries, so each file has one way to say "none" and the writer never adds or removes an empty list (M1P2).

#### CS0020 — a node folder holds another node

*Refuses.*

**Fix.** Move the inner node's folder out beside this one.

**Why.** A node folder holds exactly one node; nesting would make one node's files part of another's (M1P1.2).

#### CS0021 — a node folder lacks one of its files

*Refuses.*

**Fix.** Add the missing node.yaml or body.md; a node needs both.

**Why.** A node is its fields and its body together (M1P1.2); either alone is half a node.

#### CS0022 — a file is not UTF-8

*Refuses.*

**Fix.** Save the file as UTF-8.

**Why.** Every file is read as UTF-8, exactly, so it can be written back byte for byte (M1P1).

### CS0100–CS0199 · links

#### CS0101 — a link field is not a list of links

*Refuses.*

**Fix.** Write the field as a list, each entry with node: and reason: on separate lines.

**Why.** needs, goes-deeper and related are lists of links, each naming a node and saying why (M1P2.2).

#### CS0102 — an entry is not a link

*Refuses.*

**Fix.** Write the entry as `- node: <id>` with `reason: <sentence>` on the next line.

**Why.** Every link has a node and a reason, so a bare id is refused: the reason is what the learner reads (M1P2.2).

#### CS0103 — a link has a key it cannot have

*Refuses.*

**Fix.** Remove the key; a link has node and reason only. `any-of` groups are designed but not accepted until content needs them (W3.2).

**Why.** A link's shape is closed, so a misspelled key is caught rather than ignored (M1P2.2).

#### CS0104 — a link names no node

*Refuses.*

**Fix.** Add node: with the id of the node linked to.

**Why.** A link without a node points nowhere (M1P2.2).

#### CS0106 — a link has no reason

*Refuses.*

**Fix.** Add reason: with one sentence saying why this node needs, goes deeper into or stands beside the other.

**Why.** Every link carries a reason: it is what the learner reads instead of a bare chip, and what a reviewer judges the link by (M1P2.2, operator 2026-09-18).

#### CS0108 — a node links to itself

*Refuses.*

**Fix.** Remove the link.

**Why.** A node cannot need, go deeper into or stand beside itself; a self-link is a cycle of one (M1P2.5).

#### CS0109 — a node is linked twice under one kind

*Refuses.*

**Fix.** Remove one of the two entries, keeping the better reason.

**Why.** Each neighbour appears once under a kind, with one reason (M1P2.5).

#### CS0110 — a node has more than four peers

*Refuses.*

**Fix.** Keep the four nodes a learner might most read instead of this one, or split the node.

**Why.** related means the peer test — what a learner might read instead of this node — capped at four; a node wanting more is probably two nodes (W3.2, M1P2.5).

#### CS0111 — a node is linked under two kinds

*Refuses.*

**Fix.** Keep the link under the one kind that answers the reader's question, and remove the other.

**Why.** A node is one kind of neighbour: needs X and related X would be before and instead of at once (M1P2.5).

### CS0200–CS0299 · resources

#### CS0201 — a resource cites a provider providers.yaml does not list

*Refuses.*

**Fix.** Correct the provider's id — the closest is suggested — or add the provider to providers.yaml in a pull request of its own.

**Why.** Every resource names its provider, and providers.yaml decides which licences a provider may carry and whether it may be embedded (M3P1.2, tutor spec T4.2).

#### CS0202 — a resource carries a licence its provider does not list

*Refuses.*

**Fix.** Correct the licence to one the provider lists, or change the provider's entry in its own pull request if its terms allow it.

**Why.** Licences are recorded per provider, from its terms, so a resource cannot claim one its provider does not grant (M3P1.2, invariant 13).

#### CS0203 — a resource asks to embed from a provider that does not allow it

*Refuses.*

**Fix.** Write display: link on the resource, or, if the provider's terms now allow embedding, change its entry in providers.yaml in a pull request of its own.

**Why.** Whether a provider may be embedded is decided once, in providers.yaml, from its terms (tutor spec T4.2), not per resource. Khan Academy is linked, never embedded (issue 76).

#### CS0204 — a video names a player its provider does not use

*Refuses.*

**Fix.** Use a player the provider lists, or add the player to the provider's entry.

**Why.** A provider lists the players its videos play through, so the page only frames players it knows the provider uses (M3P5.3).

#### CS0205 — `resources:` is not a list

*Refuses.*

**Fix.** Write resources: as a list of entries.

**Why.** A node's outside resources are a list, in the order the author wants them shown (M3P1.2).

#### CS0206 — an entry is not a resource

*Refuses.*

**Fix.** Write the entry as a mapping with kind, provider, url, covers, licence, display and level.

**Why.** A resource is a small record, not a bare link (M3P1.2).

#### CS0207 — a resource has a key it cannot have

*Refuses.*

**Fix.** Remove the key or correct it to one the message lists.

**Why.** A resource's shape is closed, so a typo is caught rather than ignored (M3P1.2).

#### CS0208 — a resource lacks a required key

*Refuses.*

**Fix.** Add the key the message names.

**Why.** A resource needs its kind, provider, url, what it covers, licence, display and level to be shown and checked (M3P1.2).

#### CS0209 — a resource's provider is not an id

*Refuses.*

**Fix.** Write the provider as its id from providers.yaml.

**Why.** Providers are named by id, as providers.yaml lists them (M3P1.2).

#### CS0211 — a video's part is not a timestamp range

*Refuses.*

**Fix.** Write the part as start–end, such as 2:10–7:45.

**Why.** A video's part is where the player starts and stops, so it has to parse (M3P1.2, M3P5.3).

#### CS0212 — a video's part ends before it starts

*Refuses.*

**Fix.** Swap or correct the two timestamps.

**Why.** A player cannot stop before it starts (M3P1.2).

#### CS0213 — a video is not written player:id

*Refuses.*

**Fix.** Write video: as player:id, such as youtube:Jnk_4Maf5Fk.

**Why.** A video resource names the video it plays, because a provider's page URL does not contain the video's id (M3P5.3).

#### CS0214 — a player this page cannot play

*Refuses.*

**Fix.** Use a player the message lists.

**Why.** The page frames only players it knows how to build a no-cookie URL for (M3P5.3).

#### CS0215 — a video id is not in its player's form

*Refuses.*

**Fix.** Copy the id from the video's address; a YouTube id is eleven letters, digits, - or _.

**Why.** Each player's ids have a known form, checked so the page never builds a broken player (M3P5.3).

#### CS0216 — a resource that is not a video names a video

*Refuses.*

**Fix.** Remove video:, or set kind: video if the resource is one.

**Why.** Only a video plays in the page (M3P5.3).

#### CS0217 — an embedded video names no video

*Refuses.*

**Fix.** Add video: player:id, or write display: link.

**Why.** To embed, the page needs the video's own id, which the provider's page URL does not carry (M3P5.3).

#### CS0218 — a node cites one url twice

*Refuses.*

**Fix.** Keep one entry for the url.

**Why.** Each resource appears once in a node's Learn it (M3P1.2).

### CS0300–CS0399 · questions

#### CS0301 — `try:` is not a list

*Refuses.*

**Fix.** Write try: as a list of questions.

**Why.** A node's try questions are a list, each placed in the body by its id (M3P1.3).

#### CS0302 — an entry is not a question

*Refuses.*

**Fix.** Write the entry as a mapping with id, kind, ask, hints and rationale.

**Why.** A question is a small record (M3P1.3).

#### CS0303 — a question has a key it cannot have

*Refuses.*

**Fix.** Remove the key or correct it to one the message lists.

**Why.** A question's shape is closed, so a typo is caught rather than ignored (M3P1.3).

#### CS0304 — a question has no id

*Refuses.*

**Fix.** Add id: — the name the body places it by.

**Why.** The body places a question by its id (M3P1.3).

#### CS0305 — a question has no kind

*Refuses.*

**Fix.** Add kind: choice or kind: number.

**Why.** The kind decides how the answer is checked (M3P1.3).

#### CS0306 — a kind of question that is designed, not built

*Refuses.*

**Fix.** Use kind: choice or kind: number until the phase the message names.

**Why.** Figure questions are designed (tutor spec T7.1) and arrive with figures in M6; until then they are refused by name rather than silently ignored.

#### CS0307 — a question asks nothing

*Refuses.*

**Fix.** Add ask: with the question, as one sentence.

**Why.** The ask is what the learner reads (M3P1.3).

#### CS0308 — a choice question has an answer

*Refuses.*

**Fix.** Remove answer: and mark the right option with right: true.

**Why.** A choice question's answer is its right option, so a separate answer would be a second source of truth (M3P1.3).

#### CS0309 — a choice question has no options

*Refuses.*

**Fix.** Add options:, two to five, one marked right: true.

**Why.** A choice offers options (M3P1.3).

#### CS0310 — a number question has options

*Refuses.*

**Fix.** Remove options:, or make the question a choice.

**Why.** A number question is answered by typing a number (M3P1.3).

#### CS0311 — a number question has no answer

*Refuses.*

**Fix.** Add answer: with the number.

**Why.** The answer is what the typed number is checked against (M3P1.3).

#### CS0312 — a number question's answer is not a number

*Refuses.*

**Fix.** Write the answer as a number, without quotes or units.

**Why.** The answer is compared as a number; units go in unit: (M3P1.3).

#### CS0313 — a choice question has a unit

*Refuses.*

**Fix.** Remove unit:.

**Why.** Only a number question's answer has a unit (M3P1.3).

#### CS0314 — a choice question has a tolerance

*Refuses.*

**Fix.** Remove tolerance:.

**Why.** Only a number question is checked within a tolerance (M3P1.3).

#### CS0315 — a tolerance is not a number of 0 or more

*Refuses.*

**Fix.** Write the tolerance as 0 or a positive number.

**Why.** A tolerance is how far a typed answer may be from the right one (M3P1.3).

#### CS0316 — a question has no hints

*Refuses.*

**Fix.** Add hints:, at least one, given one at a time.

**Why.** A try question gives ordered hints while the learner answers (tutor spec T6.2).

#### CS0317 — hints are not a list

*Refuses.*

**Fix.** Write hints: as a list, one hint per entry.

**Why.** Hints are shown one at a time, in order (tutor spec T6.2).

#### CS0318 — a question has too many hints

*Refuses.*

**Fix.** Keep the hints the message allows, most useful first.

**Why.** A question with many hints stops being a question (tutor spec T6.2, M3P1.3).

#### CS0319 — a hint gives the answer away

*Refuses.*

**Fix.** Rewrite the hint so it leads toward the answer without stating it.

**Why.** A hint may not contain the answer — the right option's text, or the number standing alone (tutor spec T6.2, M3P1.3).

#### CS0320 — a question has no rationale

*Refuses.*

**Fix.** Add rationale: saying why the answer is right.

**Why.** The rationale is shown after the learner answers, right or wrong (tutor spec T6.2).

#### CS0321 — a question id is used twice

*Refuses.*

**Fix.** Give each question in the node its own id.

**Why.** The body places questions by id, so an id names one question (M3P1.3).

#### CS0322 — options are not a list

*Refuses.*

**Fix.** Write options: as a list, each with text: and, on the right one, right: true.

**Why.** A choice's options are shown in the author's order (M3P1.3).

#### CS0323 — an entry is not an option

*Refuses.*

**Fix.** Write the option as text: and, on the right one, right: true.

**Why.** An option is a small record, so the right one can be marked (M3P1.3).

#### CS0324 — an option has a key it cannot have

*Refuses.*

**Fix.** Remove the key; an option has text and right.

**Why.** An option's shape is closed, so a typo is caught rather than ignored (M3P1.3).

#### CS0325 — an option has no text

*Refuses.*

**Fix.** Add text: to the option.

**Why.** The text is what the learner chooses (M3P1.3).

#### CS0326 — `right` is not true or false

*Refuses.*

**Fix.** Write right: true on the right option, and leave it out on the others.

**Why.** Nothing is coerced: "yes" is not true (M3P1.3).

#### CS0327 — a choice has too few or too many options

*Refuses.*

**Fix.** Offer two to five options.

**Why.** One option is not a choice, and more than five is a list to read rather than a question (M3P1.3).

#### CS0328 — a choice has no right option

*Refuses.*

**Fix.** Mark the right option with right: true.

**Why.** A choice is checked against its right option (M3P1.3).

#### CS0329 — a choice has more than one right option

*Refuses.*

**Fix.** Mark exactly one option right.

**Why.** A choice has one right answer; several would need a different kind of question (M3P1.3).

### CS0400–CS0499 · body

#### CS0401 — body.md is empty

*Refuses.*

**Fix.** Write the node's body.

**Why.** Every node explains its claim in its body (M1P1.2).

#### CS0402 — a marker line the body does not read

*Refuses.*

**Retired** 2026-09-29 — the body moved to MyST fences (M4.1.2); a Markdoc-style line is now CS0414

**Fix.** Remove the line, or use a marker the body reads.

**Why.** Markers that are not yet built are refused by name rather than drawn as braces (M3P1.3).

#### CS0403 — a question is placed that node.yaml does not have

*Refuses.*

**Fix.** Correct the id in the body, or add the question to try: in node.yaml.

**Why.** The body places questions that node.yaml declares; a placement with no question would draw nothing (M3P1.3).

#### CS0404 — a question is placed twice

*Refuses.*

**Fix.** Keep one placement of the question.

**Why.** Each question is asked in exactly one place (M3P1.3).

#### CS0405 — a question is never placed

*Refuses.*

**Fix.** Place the question in body.md where it should be asked, or remove it from node.yaml.

**Why.** A question in node.yaml that the body never places would never be asked (M3P1.3).

#### CS0406 — a directive inside a directive

*Refuses.*

**Fix.** Close the outer directive before opening the next; directives sit at the top level of body.md.

**Why.** Nesting is not read in M4: the first kind of block that needs it brings it (spec M4B.3).

#### CS0407 — a directive with options

*Refuses.*

**Fix.** Remove the `:key: value` line; no directive takes options yet.

**Why.** Options are part of MyST, but none of the wired blocks has one, so a line that looks like an option is refused rather than read as prose (spec M4B.3).

#### CS0408 — a directive is never closed

*Refuses.*

**Fix.** Close the directive with `:::` on a line of its own.

**Why.** An unclosed fence would silently swallow the rest of the body into one block (spec M4B.3).

#### CS0409 — a question placement with a body

*Refuses.*

**Fix.** Write `:::{try} <id>` and `:::` on the next line, with nothing between; the question lives in node.yaml.

**Why.** A `try` block only places a question; its text, hints and rationale are fields of node.yaml (spec M4B.2).

#### CS0410 — a question placement names no question

*Refuses.*

**Fix.** Write the question's id after `:::{try}`.

**Why.** A placement says which question is asked here (spec M4B.2).

#### CS0411 — a callout with no body

*Refuses.*

**Fix.** Write the callout's text between its opening line and `:::`, or remove it.

**Why.** A callout with nothing in it draws an empty box (spec M4B.3).

#### CS0412 — a directive this format does not have

*Refuses.*

**Fix.** Use `try`, `misconception`, `caveat` or `convention` — the closest is suggested.

**Why.** The body reads only its own directives; anything else would be drawn as text or lost (spec M4B.3, invariant 6).

#### CS0413 — a kind of block that is designed, not built

*Refuses.*

**Fix.** Leave the block out until the phase the message names.

**Why.** Figures, math, images, examples, problems and claims are designed (W5.1) and arrive with the phase that builds them; until then they are refused by name rather than silently ignored (spec M4B.1).

#### CS0414 — a Markdoc-style tag line

*Refuses.*

**Fix.** Write the directive as a MyST colon fence: `:::{try} <id>` then `:::` on the next line.

**Why.** The body moved from Markdoc-style `{% %}` markers to MyST fences in M4.1.2, as R1 chose; an old line is refused with a pointer rather than drawn as braces (spec M4B.2).

#### CS0415 — a body its blocks would not write back unchanged

*Refuses.*

**Fix.** Write directive lines exactly as `:::{name} argument` and `:::`, with no extra spaces, nothing between a try's two lines, one line ending throughout, and a line ending after the last `:::`.

**Why.** Studio writes a body back from its blocks, so a body is accepted only if that gives the same bytes (spec M4B.4). Anything the blocks cannot carry, such as trailing spaces on a directive line, is refused here rather than silently rewritten later.

### CS0500–CS0599 · graph

#### CS0501 — a link names a node the content does not have

*Refuses.*

**Fix.** Correct the id — the closest is suggested — or add the node.

**Why.** Links are checked across the whole content folder, so no route or page points at a node that is not there (M1P3.4).

#### CS0502 — a peer link is written on one side only

*Refuses.*

**Fix.** Add the related link, with its reason, to the other node's node.yaml.

**Why.** related is written on both nodes, so any node.yaml shows all its neighbours (M1P2.4).

#### CS0503 — a goes-deeper link points to a lower level

*Refuses.*

**Fix.** Link to a node at the same level or higher, or change the link's kind.

**Why.** Going deeper never goes down in level (M1P3.4, tutor spec T10.1).

#### CS0504 — needs or goes-deeper links form a cycle

*Refuses.*

**Fix.** Remove the link that closes the ring; a node cannot come before itself.

**Why.** A route is ordered by needs, so a cycle would have no order (invariant 2, M1P3.4). One message is given per tangle, with one whole ring.

### CS0600–CS0699 · registries

#### CS0601 — regions.yaml is missing

*Refuses.*

**Fix.** Add regions.yaml at the content root.

**Why.** Every node names a region, and regions.yaml lists them (M1P1.3).

#### CS0602 — `regions:` is not a list

*Refuses.*

**Fix.** Write regions: as a list of entries, each with id and name.

**Why.** The regions' order is the route's tie-break, so they are a list (M2P1.4).

#### CS0603 — an entry is not a region

*Refuses.*

**Fix.** Write the entry with id: and name:.

**Why.** A region is a small record (M1P1.3).

#### CS0604 — a region id is listed twice

*Refuses.*

**Fix.** Keep one entry for the id.

**Why.** A region has one place in the order (M2P1.4).

#### CS0605 — a registry entry lacks a field

*Refuses.*

**Fix.** Add the field the message names.

**Why.** Registry entries are read by every node that cites them (M1P1.3, M3P1.2).

#### CS0606 — `providers:` is not a list

*Refuses.*

**Fix.** Write providers: as a list of entries.

**Why.** providers.yaml lists every provider a resource may cite (M3P1.2).

#### CS0607 — an entry is not a provider

*Refuses.*

**Fix.** Write the entry with id, name, licences and embed.

**Why.** A provider is a small record (M3P1.2).

#### CS0608 — a provider id is listed twice

*Refuses.*

**Fix.** Keep one entry for the id.

**Why.** Each provider's terms are recorded once (M3P1.2).

#### CS0609 — a provider lists no licences

*Refuses.*

**Fix.** Write licences: as a list with at least one licence.

**Why.** A resource carries one of its provider's licences, so a provider must list one (M3P1.2).

#### CS0610 — `players:` is not a list

*Refuses.*

**Fix.** Write players: as a list, such as [youtube], or leave it out.

**Why.** A provider lists the players its videos play through (M3P5.3).

#### CS0611 — `embed` is not true or false

*Refuses.*

**Fix.** Write embed: true or embed: false.

**Why.** Nothing is coerced: "yes" is not true (M3P1.2).

#### CS0612 — a resource is cited and providers.yaml is missing

*Refuses.*

**Fix.** Add providers.yaml at the content root.

**Why.** providers.yaml is needed once a resource cites a provider, and not before (M3P1.2).

### CS0700–CS0799 · discovery

#### CS0701 — the content root is not a folder

*Refuses.*

**Fix.** Pass the folder that holds the node folders and regions.yaml.

**Why.** Validation reads a whole content folder (M1P3.2).

#### CS0702 — a folder has a body and no node.yaml

*Refuses.*

**Fix.** Add node.yaml beside body.md, or remove body.md.

**Why.** A folder with a body is probably a node missing its fields, so it is reported rather than skipped (M1P3.2).

#### CS0703 — a near miss of node.yaml

*Refuses.*

**Fix.** Rename the file to node.yaml.

**Why.** node.yml or Node.yaml would otherwise be skipped silently (M1P3.2).

#### CS0704 — the content root holds a node's files

*Refuses.*

**Fix.** Move the node's files into a folder of their own inside the root.

**Why.** Node folders go inside the content root; the root is not a node (M1P3.2).

#### CS0705 — two folders have the same name

*Refuses.*

**Fix.** Rename one folder; a node's id is its folder's name.

**Why.** Ids are unique across the content, wherever the folders sit (M1P3.2).

#### CS0706 — a near miss of exam.yaml

*Refuses.*

**Fix.** Rename the file to exam.yaml.

**Why.** exam.yml or exams.yaml would otherwise be skipped silently, and a node would lose its pool without a word (M4E.3).

### CS0800–CS0899 · exam

#### CS0801 — exam.yaml holds a key other than exam

*Refuses.*

**Fix.** Remove the key; exam.yaml holds only the exam: list.

**Why.** The file is one pool and nothing else, so a typo is a problem rather than ignored (M4E.1).

#### CS0802 — exam.yaml has no exam: list

*Refuses.*

**Fix.** Put the questions under exam:, or delete the file.

**Why.** A node's pool is the exam: list in exam.yaml (M4E.1).

#### CS0803 — exam: is not a list

*Refuses.*

**Fix.** Write exam: as a list of questions, each starting with - id:.

**Why.** A pool is a list of questions, asked in no fixed order (M4E.1).

#### CS0804 — the pool is empty

*Refuses.*

**Fix.** Delete exam.yaml; a node without a pool needs no file.

**Why.** An empty file says nothing a missing one does not, and a node without exam.yaml is valid (M4E.1).

#### CS0805 — an entry in exam: is not a question

*Refuses.*

**Fix.** Write each question as a mapping starting with - id:.

**Why.** Each entry of the pool is one question (M4E.1).

#### CS0806 — an unknown key in an exam question

*Refuses.*

**Fix.** Use only id, kind, ask, level, options, answer, unit, tolerance and rationale.

**Why.** The fields are closed, so a typo is reported rather than ignored (M4E.1).

#### CS0807 — an exam question has hints

*Refuses.*

**Fix.** Remove the hints; put what they say in the rationale, which the learner sees with the results.

**Why.** A self-test gives no hints and no feedback until the end (tutor spec T7.1). Hints belong to try questions, which teach as they ask.

#### CS0808 — an unknown key in an exam option

*Refuses.*

**Fix.** Use only text, right and misconception.

**Why.** The fields are closed, so a typo is reported rather than ignored (M4E.1).

#### CS0809 — a misconception names no callout

*Refuses.*

**Fix.** Write the exact title of a misconception callout in body.md, or add that callout.

**Why.** A wrong answer will step back to the misconception it reveals (tutor spec T6.1), so the name must lead somewhere the learner can read (M4E.1).

#### CS0810 — the right option names a misconception

*Refuses.*

**Fix.** Move the misconception to the wrong option that reflects it.

**Why.** A misconception explains a wrong answer; the right one has nothing to step back to (M4E.1).

#### CS0811 — an exam question reuses a try question's id

*Refuses.*

**Fix.** Give the exam question an id no question in node.yaml uses.

**Why.** Every answer is stored as evidence named by node and question id (tutor spec T7), so one id must name one question across both pools (M4E.3).

#### CS0812 — a pool holds more than 40 questions

*Refuses.*

**Fix.** Split the node, or keep the best 40 questions.

**Why.** 40 is a bound, not a target: it catches a draft or a generator that ran away. How many questions an exam asks is the exam builder's business (M4E.3, M4E.7).

#### CS0813 — a pool has fewer than 4 questions

*Warns; never blocks.*

**Fix.** Write more questions until the pool has at least 4; more is better.

**Why.** A node with fewer than 4 questions is left out of self-tests, since a result needs evidence from at least 2 questions and retakes should not repeat (tutor spec T7.1, M4E.7). A warning: a pool may be written a question at a time.

#### CS0814 — a question's level is two or more from the node's

*Warns; never blocks.*

**Fix.** Ask at or near the node's level, or move the question to the node it fits.

**Why.** A node holds exam questions at or near its own level, and review flags one two or more levels away (tutor spec T10.1). A warning: review decides.

## CW — code-weaver: routes and search

### CW0001–CW0099 · routes

#### CW0001 — two topics have one id

*Refuses.*

**Fix.** Give each topic its own id; validated content never has two.

**Why.** The weaver checks its graph when it is built, so a weave never fails for the graph's own reasons (M2P1.3).

#### CW0002 — a topic's region is not in the order

*Refuses.*

**Fix.** Add the region to the order the graph is built with.

**Why.** Stops are ordered by region, so every region has a place in the order (M2P1.4).

#### CW0003 — a topic's level is not in the order

*Refuses.*

**Fix.** Add the level to the order the graph is built with.

**Why.** A route reports its level span from the level order (M2P2.4).

#### CW0004 — a topic needs one the graph does not have

*Refuses.*

**Fix.** Add the needed topic, or remove the need.

**Why.** A route walks needs back from its goals; a need to nothing has nowhere to go (M2P1.3).

#### CW0005 — the graph's needs form a cycle

*Refuses.*

**Fix.** Remove the need that closes the ring.

**Why.** A route orders each stop after what it needs; a cycle has no order (invariant 2, M2P1.3).

#### CW0006 — a goal is not in the graph

*Refuses.*

**Fix.** Use a node id the content has; code-weaver find suggests them.

**Why.** An unknown goal is a bad request, not a bad graph, so it is reported apart from the graph's own problems (M2P1.3).

#### CW0007 — the content has problems

*Refuses.*

**Fix.** Run code-schema validate on the folder and fix what it reports.

**Why.** The weaver weaves only content that validates (M2 part 3).

#### CW0008 — the content root is not a folder

*Refuses.*

**Fix.** Pass the folder that holds the node folders and regions.yaml.

**Why.** The route and find commands read a whole content folder (M2 part 3).

### CW0100–CW0199 · find

#### CW0101 — a search has no words

*Refuses.*

**Fix.** Give at least one word to search for.

**Why.** Search ranks topics by the words typed; with none there is nothing to rank (M3P2.3).

## CA — the API

### CA0001–CA0099 · index

#### CA0001 — nothing has been indexed

*Refuses.*

**Fix.** Run manage.py rebuild_index with a content folder, or wait for the worker to index one.

**Why.** The API answers from the index, and says so plainly with 503 before any build was applied, rather than answering as if the content were empty (M1P6.4).

#### CA0002 — a node is not in the index

*Refuses.*

**Fix.** Check the id; the node may have been removed or renamed since the link was made.

**Why.** An id not in the index is a normal case — links outlive renames — so it is a 404 with a sentence, not an error (M1P6.4).

#### CA0003 — a search has no words

*Refuses.*

**Fix.** Send q= with at least one word.

**Why.** Search ranks topics by the words given (M3P2.4).

#### CA0004 — no content root was given

*Refuses.*

**Fix.** Pass --root, or set CODE_CONTENT_ROOT.

**Why.** rebuild_index has no default folder, so it never quietly indexes the wrong one (M1P6.2).

#### CA0005 — the content root is not a folder

*Refuses.*

**Fix.** Pass the folder that holds the node folders and regions.yaml.

**Why.** rebuild_index reads a whole content folder (M1P6.2).

#### CA0006 — the content has problems, so nothing was applied

*Refuses.*

**Fix.** Fix the problems listed after this line — each has its own code — and rebuild.

**Why.** A rebuild is all or nothing: content with any problem changes nothing, so a route is never silently shortened by a skipped node (M1P5.2).

### CA0100–CA0199 · accounts

#### CA0101 — a Studio route was asked by nobody signed in

*Refuses.*

**Fix.** Sign in, by email and password or GitHub; an account comes only from an invite.

**Why.** Studio is for the team, and the team signs in (M4.3 spec, M4A.4). Learner routes need no account and never answer this.

#### CA0102 — a Studio route needs a higher role

*Refuses.*

**Fix.** Ask an operator for the role the route names.

**Why.** Roles rank author < reviewer < operator, and each Studio route names the lowest role that may use it (W7.1; M4.3 spec, M4A.1, M4A.4).

#### CA0103 — no invite has this link, or no pending invite has this id

*Refuses.*

**Fix.** Check the link was copied whole, or ask an operator for a new invite.

**Why.** An invite is found by its token's hash; a link that matches none is not an invite (M4A.2).

#### CA0104 — the invite has expired

*Refuses.*

**Fix.** Ask an operator for a new invite.

**Why.** An invite lasts seven days, so a link left in a mailbox does not open sign-up forever (M4A.2).

#### CA0105 — the invite was withdrawn

*Refuses.*

**Fix.** Ask an operator for a new invite.

**Why.** An operator revoked it, or a newer invite to the same address replaced it (M4A.2).

#### CA0106 — the invite has been used

*Refuses.*

**Fix.** Sign in with the account it made; an invite opens one sign-up.

**Why.** An invite is single-use, so a forwarded link cannot make a second account (M4A.2).

#### CA0107 — the address already has an account

*Refuses.*

**Fix.** Change the member's role on the team instead of inviting them.

**Why.** One person has one account and one role (M4A.1); an invite makes a new account.
