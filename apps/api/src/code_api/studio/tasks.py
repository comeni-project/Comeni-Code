"""Studio's background tasks (M4.6 spec, M4L.4): a landing, run by any worker."""

from celery import shared_task
from django.utils import timezone

from code_api.studio import github, landing
from code_api.studio.models import Landing


@shared_task(name="code_api.studio.tasks.land")
def land(public_id: str) -> None:
    found = Landing.objects.filter(public_id=public_id).first()
    if found is None:
        return
    client = github.from_settings()
    if client is None:
        landing.refuse_unconfigured(found)
        return
    landing.run(found, client)


@shared_task(name="code_api.studio.tasks.watch_landings")
def watch_landings() -> None:
    client = github.from_settings()
    if client is None:
        return
    for each in Landing.objects.filter(state__in=[Landing.State.OPEN, Landing.State.FAILED]):
        landing.watch(each, client)
    # A landing lost in the queue (Celery acknowledges on delivery), or interrupted mid-run (#203).
    stuck = timezone.now() - landing.STUCK_AFTER
    for each in Landing.objects.filter(state=Landing.State.PENDING, started_at__lt=stuck):
        landing.run(each, client)
