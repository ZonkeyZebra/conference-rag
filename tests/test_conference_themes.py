import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "06_generate_conference_themes.py"
)
SPEC = importlib.util.spec_from_file_location("conference_themes", SCRIPT_PATH)
conference_themes = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(conference_themes)


class ConferenceThemeTests(unittest.TestCase):
    def setUp(self):
        self.talks = [
            {
                "id": "talk_001",
                "title": "Prayer and Faith",
                "speaker": "Speaker One",
                "url": "https://example.org/talk-one",
                "text": "A teaching about prayer.",
            },
            {
                "id": "talk_002",
                "title": "A Life of Discipleship",
                "speaker": "Speaker Two",
                "url": "https://example.org/talk-two",
                "text": "A teaching about faith.",
            },
        ]

    def test_chunk_talks_keeps_talks_together_and_splits_at_limit(self):
        talks = [
            {"title": "A", "speaker": "S", "text": "x" * 8},
            {"title": "B", "speaker": "S", "text": "x" * 8},
            {"title": "C", "speaker": "S", "text": "x" * 8},
        ]
        with patch.object(conference_themes, "CHUNK_CHAR_LIMIT", 18):
            chunks = conference_themes.chunk_talks(talks)

        self.assertEqual([[talk["title"] for talk in chunk] for chunk in chunks],
                         [["A"], ["B"], ["C"]])

    @patch.object(conference_themes, "request_json")
    def test_candidate_extraction_discards_unknown_citation_ids(self, request_json):
        request_json.return_value = [{
            "title": "Prayer",
            "description": "Talks teach the importance of prayer.",
            "source_ids": ["talk_001", "not-a-real-talk"],
        }]

        result = conference_themes.extract_candidate_themes(
            client=None,
            talks=self.talks[:1],
            conference_name="April 2025 General Conference",
            batch_number=1,
        )

        self.assertEqual(result[0]["source_ids"], ["talk_001"])

    @patch.object(conference_themes, "request_json")
    def test_final_themes_only_link_candidate_source_talks(self, request_json):
        request_json.return_value = [{
            "title": "Prayer",
            "description": "The talks encourage a life of prayer.",
            "source_ids": ["talk_001", "talk_002", "unknown"],
        }]
        candidates = [{
            "title": "Prayer",
            "description": "Prayer is discussed.",
            "source_ids": ["talk_001", "talk_002"],
        }]

        result = conference_themes.synthesize_themes(
            client=None,
            candidates=candidates,
            all_talks=self.talks,
            conference_name="April 2025 General Conference",
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(
            result[0]["talks"],
            [
                {
                    "title": "Prayer and Faith",
                    "speaker": "Speaker One",
                    "url": "https://example.org/talk-one",
                },
                {
                    "title": "A Life of Discipleship",
                    "speaker": "Speaker Two",
                    "url": "https://example.org/talk-two",
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
