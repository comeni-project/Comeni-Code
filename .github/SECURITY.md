# Security policy

## Reporting

Report privately through
[GitHub private vulnerability reporting](https://github.com/comeni-project/Comeni-Code/security/advisories/new).
Please do not open a public issue first.

Expect an acknowledgement within a week. If a report is valid we will agree a disclosure timeline
with you and credit you in the advisory, unless you would rather we did not.

There is no released software yet, so there are no supported versions. This policy describes what
we will treat as a security issue from the first line of code, and applies now to anything in the
design that would create one.

## What counts

Code's claims are that learners are not tracked beyond what learning needs, that only reviewed or
clearly labelled content reaches them, and that models are only called where the design says so.
Anything that undermines those is a security issue, not a bug report:

**Learner data reaching a model or an author.** Authors see aggregates only, and a learner's goal
suggestion carries an anonymous session and nothing else. A path that sends a learner's identity,
answers or history to a model, or shows them to an author, qualifies.

**Model keys leaving the gateway.** Provider keys live in the LiteLLM gateway, never in a browser
or a learner session.

**Content that executes.** Node pages are validated blocks rendered by our components. Markup,
script or styling that survives from a block into a learner's page — through a figure's data, an
image caption, a citation, or connecting text — is critical.

**Unreviewed content presented as reviewed.** A way for model-written text to reach a learner
without its *not yet reviewed* label, or for a draft to be published without the review the
design requires.

**Instructions smuggled through content.** Text inside a node, a request or a source that makes the
assistant act outside the content API, or outside what the author asked for.

**Media without a licence.** A way to attach an image that bypasses the author-and-licence check.

## A test is the best report

Once there is code: a failing test that demonstrates the problem is the fastest route to a fix.
Until then, a short description of the path, and which section of the spec it breaks, is ideal.
