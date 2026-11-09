"""What the problem builder knows about each kit (M6.8b spec, M6PB.4): its rung, a line on it, its
params' schema, its mistakes with a line each, and an example with its sample computed. Read from
code-problems' registry, the one place kits are declared."""

from code_problems import Case, Rng, registry
from code_problems.kit import Kit
from django.http import HttpRequest
from ninja import Router

from code_api.accounts.access import studio
from code_api.accounts.roles import Role
from code_api.studio.schemas import KitMistakeOut, ProblemKitOut

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))


def _kit_out(kit: Kit) -> ProblemKitOut:
    sample = kit.example["sample"]
    seed, params = sample["seed"], sample["params"]
    assert isinstance(seed, int) and isinstance(params, dict)
    dataset = kit.generate(params, Rng(seed))
    return ProblemKitOut(
        name=kit.name,
        rung=kit.rung,
        about=kit.about,
        params_schema=dict(kit.schema),
        mistakes=[KitMistakeOut(name=name, says=kit.says[name]) for name in kit.mistakes],
        example={key: dict(value) for key, value in kit.example.items()},
        sample_dataset=dataset.text,
        sample_output=kit.solve(Case(params, dataset, "")),
    )


@router.get(
    "", response=list[ProblemKitOut], summary="The problem kits, as the builder offers them"
)
def problem_kits(request: HttpRequest) -> list[ProblemKitOut]:
    return [_kit_out(kit) for kit in registry.KITS.values()]
