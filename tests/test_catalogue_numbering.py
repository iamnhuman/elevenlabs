"""Numbering changes must not mix sections or reassign existing artwork."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "prepare_samples", Path(__file__).resolve().parents[1] / "scripts/prepare-samples.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sound(identity, duration):
    return {"id": identity, "duration": duration}


class NumberingTests(unittest.TestCase):
    def test_sections_start_at_one_and_exactly_thirty_seconds_is_a_sample(self):
        sounds = [sound("a", 15), sound("b", 120), sound("c", 30), sound("d", 30.001)]
        module.number_samples(sounds)
        self.assertEqual([s["title"] for s in sounds], ["001", "001", "002", "002"])
        self.assertEqual([s["artworkNumber"] for s in sounds], [1, 2, 3, 4])

    def test_migration_keeps_order_and_the_original_covers(self):
        previous = [dict(sound("sample-a", 15), number=1),
                    dict(sound("track-a", 120), number=2),
                    dict(sound("sample-b", 8), number=3)]
        sounds = [sound("sample-b", 8), sound("track-a", 120), sound("sample-a", 15)]
        module.number_samples(sounds, previous)
        self.assertEqual([s["id"] for s in sounds], [s["id"] for s in previous])
        self.assertEqual([s["number"] for s in sounds], [1, 1, 2])
        self.assertEqual([s["artworkNumber"] for s in sounds], [1, 2, 3])

    def test_rebuild_and_new_files_do_not_reorder_equal_numbers(self):
        previous = [sound("sample-a", 15), sound("track-a", 120), sound("sample-b", 8)]
        module.number_samples(previous)
        sounds = [sound("track-new", 60), sound("sample-new", 9),
                  sound("sample-b", 8), sound("track-a", 120), sound("sample-a", 15)]
        module.number_samples(sounds, previous)
        self.assertEqual(sounds[:3], previous)
        self.assertEqual([s["number"] for s in sounds[3:]], [2, 3])
        self.assertEqual([s["artworkNumber"] for s in sounds], [1, 2, 3, 4, 5])
        rebuilt = deepcopy(sounds)
        module.number_samples(rebuilt, sounds)
        self.assertEqual(rebuilt, sounds)


if __name__ == "__main__":
    unittest.main()
