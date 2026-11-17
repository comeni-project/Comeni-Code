import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ai", "0003_sitescore_settings"),
        ("studio", "0009_revision_origins_revision_provenance_draftproposal"),
    ]

    operations = [
        migrations.AddField(
            model_name="draftproposal",
            name="evaluations",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="verdict",
            name="score_agreement",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="DraftScore",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("target", models.TextField()),
                ("content_digest", models.CharField(max_length=64)),
                ("rubric_version", models.TextField()),
                ("overall", models.PositiveSmallIntegerField()),
                ("parts", models.JSONField(default=dict)),
                ("judge_model", models.TextField()),
                ("judge_settings", models.JSONField(default=dict)),
                (
                    "call",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="scores",
                        to="ai.aicall",
                    ),
                ),
                (
                    "draft",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scores",
                        to="studio.draft",
                    ),
                ),
                (
                    "proposal",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="score",
                        to="studio.draftproposal",
                    ),
                ),
                (
                    "revision",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="scores",
                        to="studio.revision",
                    ),
                ),
            ],
        ),
    ]
