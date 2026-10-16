# M6.3 — Images

**Status: agreed 2026-10-16.** The third part of M6 (#325), issue #330.
Designed with the operator on 2026-10-16: **images are stored in the node's folder**, and an author
adds one **by upload or from Wikimedia Commons**. The rest is the agent's, each marked *my call*.
From W5.1 (*an asset, alt text, caption, author, source, licence — refused without author and
licence*), W5.2 (*Wikimedia Commons first, author and licence from its metadata*), invariant 6
(*images carry author and licence or are refused*) and invariant 13 (*Code organises; it does not
copy* — an image is copied only where its licence allows it), and the Node board's *Figure 5*.

It decides:

- the image in the format: the file, the block and its record (M6IM.1);
- which files and licences are accepted (M6IM.2);
- where a draft's images are kept, and how they land and reach learners (M6IM.3);
- adding one in Studio, by upload or from Commons (M6IM.4);
- the page (M6IM.5), the build and *done when* (M6IM.6).

No figures (M6.4), no image search by a model (M5), no image in an exam answer option (M6.6 brings
figure options; images there come with them).

---

## M6IM.1 In the format

**The file sits in the node's folder** beside `body.md`, under an `images/` folder:
`algorithms/de-bruijn-graphs/images/bandage-assembly.png`. Names are lowercase, digits and
hyphens, with the format's extension.

**The block places it**, as a try block places a question:

````
:::{image} bandage-assembly.png
What a bacterial assembly graph looks like in practice: long unbranched paths joined at repeats.
:::
````

The argument is the file's name; the content is the **caption**, one paragraph of Markdown
(required). **The record is in `node.yaml`**, one entry per file, as resources are:

```yaml
images:
  - file: bandage-assembly.png
    alt: An assembly graph drawn as long grey paths that meet and branch at a few knots.
    author: Jane Doe
    source: https://commons.wikimedia.org/wiki/File:Bandage_assembly.png
    licence: CC BY-SA 4.0
```

`alt` (what the image shows, for a reader who cannot see it), `author`, `source` (where it came
from: a Commons page, or `own work`) and `licence` are all required. **Refused**: a block naming no
recorded image, a record no block places, a record whose file is missing, a file no record names,
a missing field. *My call*: the record in `node.yaml` (one place for everything that is not prose,
as resources and questions; the body stays prose and placements).

An **exam stem** may hold an image block (tutor spec T7.1); its record and file are the node's, and
a stem places it as the body does, so the check reads `exam.yaml` too (*my call*).

*Rejected:* options on the directive (`:alt:`, `:licence:` — the format reads no options, CS0407,
and a record is checked like every other); a separate YAML data file per image (more files, the
same fields).

## M6IM.2 Which files and licences

- **Formats**, by their first bytes, never by extension alone: **PNG, JPEG and WebP**. **SVG is
  refused** for now (*my call*, kept by the operator: an SVG is a document that can carry script
  and links — invariant 6; drawn figures are M6.4's components). SVG may come back later, for
  example uploaded by trusted roles and sanitised; that is its own change.
- **At most 2 MB** a file (*my call*: under the content repository's 5 MB check, and a page loads
  every image it shows). Commons images are fetched at a bounded width (M6IM.4), so few come
  near it.
- **Licences that allow copying and showing as-is**: CC0, public domain, CC BY and CC BY-SA in any
  version, ported or not (`CC BY-SA 3.0 de` is CC BY-SA 3.0, Germany). **Refused**: NC and ND
  licences, and anything else (*my call*: the content repository is CC BY 4.0 and public; an NC or
  ND image cannot sit in it under the same terms). A record's `licence` is one canonical string:
  `CC0 1.0`, `Public domain`, `CC BY <version>[ <port>]`, `CC BY-SA <version>[ <port>]`; the
  page links each to its deed, built from the string. The list is code-schema's, and widening it
  is a reviewed change.
- **From Commons** (*my call*): every public-domain flavour (`PD-US`, `PD-old`, `Public domain`,
  …) is `Public domain`; a file under several licences takes the first accepted one, in the order
  CC0, public domain, CC BY, CC BY-SA; a file under none is refused with its licences named.

New codes in the CS04xx band (body) and CS0xxx for the record, each with a test.

## M6IM.3 Kept, landed and served

**A draft's images** are kept in Postgres, content-addressed: an `Asset` row per distinct file
(sha256, media type, size, bytes), and each `Revision` names its images as `{file: sha256}`. A
save that adds, replaces or removes an image is one revision, like every other edit; nothing is
written twice (*my call*: drafts already live in Postgres, R1; files on a volume would be a second
store to back up).

**Review** (*my call*, invariant 5: nobody's pixels land unseen): an image block is its own review
key, kind `image`, whose content is the block, its record and the file's sha256 together; a new
file under the same name is a change, so an earlier verdict on it does not carry over. The review
screen shows the image, its caption and its credit, as the page draws them.

**Landing** writes each image as a Git blob (base64, Git Data API) beside the node's text files;
an image no longer placed is removed from the folder. The batch's in-place check reads the
draft's images too.

**The index** keeps each landed node's images (`NodeImage`: node, file, media type, bytes), read from `main`'s tarball like the rest; the follower's tarball cap rises from 50 MB, set when
content was text (M4F.2), to 500 MB (*my call*). **Learners** load them from `GET /api/nodes/{id}/images/{file}`,
served with a long cache and the file's own media type; **Studio's preview** from
`GET /api/studio/drafts/{id}/images/{file}` (members only).

## M6IM.4 Adding one in Studio

The workbench's *Add* gains **Image**. Its editor has two ways in and one record:

- **From Wikimedia Commons**: paste a Commons file page link. The API asks Commons' API for the
  file's author, licence, licence URL and description, and fetches the image at most **1600 px**
  wide, as Commons renders it: an SVG, TIFF or GIF original arrives as Commons' PNG or JPEG
  rendering, which is accepted (a raster carries no script). If that is over 2 MB, it is fetched
  again at 1000 px, and refused only if still over (*my call*). The record's author, source and licence are filled from Commons and shown read-only
  (*my call*: the credit is right by construction); the author writes the **alt text and caption**.
  A Commons file whose licence is not accepted is refused with its licence named.
- **Upload**: pick a file (PNG, JPEG, WebP, at most 2 MB); the author types **author, source and
  licence** (a choice from the accepted list) as well as alt text and caption.

Fetching from Commons is an outbound call from the API (no model; `requests`, with a timeout,
User-Agent naming Code and its repository as Wikimedia asks). A failure is said in words.

The editor shows the image as it will be drawn, its credit line and its checks. **No new board**
(*my call*): the Node board's *Figure 5* draws the result, and the editor uses the workbench's own
fields.

## M6IM.5 The page

An image is drawn as the Node board's *Figure 5*: the image, then its **caption** and its **credit
line** — *Image: <author>, via <source's site> · <licence> · source* — the licence linking to its
deed, the source to its page. `alt` is the image's alt text. Figures are numbered on the page in
reading order (*Figure 5.*), as the board does; M6.4's figures share the sequence, and an exam
stem's image is not numbered, being no part of the page (*my call*).

**The content repository's check** reads images only once its pinned `code-schema` moves past this
part; moving the pin is a pull request there, done with the first landing (#324), confirmed by the
operator then. Until it moves, nothing with an image lands (*my call*: no landing happens before
M5 anyway).

## M6IM.6 The build, and done when

`code-schema` first (the block, the record, files and licences, the folder's `images/`), then the
drafts' assets and the save, then landing and the index, then the Commons fetch, then the page and
the workbench. Test-first; the Commons API is a stub in tests (a recorded answer), never called by
the suite. A fixture image (a small PNG, own work, CC BY 4.0) joins the de Bruijn fixture.

**Done when**, walked against `runserver` and Vite as an author:

1. An image added from a Commons link arrives with its author and licence filled; one added by
   upload saves with the author's credit; both draw in the preview with their credit lines.
2. An NC-licensed Commons file and an SVG upload are refused, each with its code.
3. The de Bruijn fixture's image draws on the Node page with caption and credit, light and dark,
   compared with the Node board's *Figure 5* at its width.
4. Landing a draft with an image would write the file as a blob (checked against the fake GitHub
   client, as M4.6's tests do), and the index serves the image after a rebuild.
