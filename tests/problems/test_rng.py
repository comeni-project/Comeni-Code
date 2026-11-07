"""Our own PRNG (M6.7 spec, M6PR.1): splitmix64, so a learner's dataset reads the same in a later
Python. The first outputs are pinned; 0xE220A8397B1DCDAF is splitmix64's published first value."""

from code_problems.rng import Rng


def test_the_first_outputs_are_pinned() -> None:
    def first(seed: int) -> list[int]:
        rng = Rng(seed)
        return [rng.next() for _ in range(3)]

    assert first(0) == [16294208416658607535, 7960286522194355700, 487617019471545679]
    assert first(0)[0] == 0xE220A8397B1DCDAF
    assert first(1) == [10451216379200822465, 13757245211066428519, 17911839290282890590]
    assert first(1 << 32) == [14135772400868000056, 4011968247314693437, 12634733894835514069]


def test_below_stays_in_range_and_a_seed_repeats() -> None:
    rng = Rng(7)
    drawn = [rng.below(10) for _ in range(500)]
    assert set(drawn) == set(range(10))
    again = Rng(7)
    assert [again.below(10) for _ in range(500)] == drawn


def test_letters_and_choice() -> None:
    rng = Rng(3)
    word = rng.letters(40)
    assert len(word) == 40 and set(word) <= set("ACGT")
    assert rng.choice(["a", "b", "c"]) in {"a", "b", "c"}
