from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai", "0002_aicall_call_settings")]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="minimum_score",
            field=models.PositiveSmallIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="max_redrafts",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
