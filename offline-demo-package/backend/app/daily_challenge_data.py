"""Curated Daily Challenge Bank and Deterministic Selection.

Provides:
- 14 pre-reviewed educational cybersecurity scenarios tailored to Ethiopian contexts.
- Fully deterministic date-based selection without pseudo-random number generators.
- Anti-duplicate XP tracking support.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

DAILY_CHALLENGES: List[Dict[str, Any]] = [
    {
        "id": "dc_01",
        "topic": "phishing_advance_fee",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_01.scenario",
        "question_key": "daily.dc_01.question",
        "options_keys": [
            "daily.dc_01.o0",
            "daily.dc_01.o1",
            "daily.dc_01.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_01.explanation",
    },
    {
        "id": "dc_02",
        "topic": "credential_harvesting_telecom",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_02.scenario",
        "question_key": "daily.dc_02.question",
        "options_keys": [
            "daily.dc_02.o0",
            "daily.dc_02.o1",
            "daily.dc_02.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_02.explanation",
    },
    {
        "id": "dc_03",
        "topic": "fake_mobile_money_reversal",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_03.scenario",
        "question_key": "daily.dc_03.question",
        "options_keys": [
            "daily.dc_03.o0",
            "daily.dc_03.o1",
            "daily.dc_03.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_03.explanation",
    },
    {
        "id": "dc_04",
        "topic": "malicious_apk_distribution",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_04.scenario",
        "question_key": "daily.dc_04.question",
        "options_keys": [
            "daily.dc_04.o0",
            "daily.dc_04.o1",
            "daily.dc_04.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_04.explanation",
    },
    {
        "id": "dc_05",
        "topic": "public_wifi_interception",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_05.scenario",
        "question_key": "daily.dc_05.question",
        "options_keys": [
            "daily.dc_05.o0",
            "daily.dc_05.o1",
            "daily.dc_05.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_05.explanation",
    },
    {
        "id": "dc_06",
        "topic": "password_entropy_hygiene",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_06.scenario",
        "question_key": "daily.dc_06.question",
        "options_keys": [
            "daily.dc_06.o0",
            "daily.dc_06.o1",
            "daily.dc_06.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_06.explanation",
    },
    {
        "id": "dc_07",
        "topic": "support_bot_impersonation",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_07.scenario",
        "question_key": "daily.dc_07.question",
        "options_keys": [
            "daily.dc_07.o0",
            "daily.dc_07.o1",
            "daily.dc_07.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_07.explanation",
    },
    {
        "id": "dc_08",
        "topic": "lookalike_domain_https",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_08.scenario",
        "question_key": "daily.dc_08.question",
        "options_keys": [
            "daily.dc_08.o0",
            "daily.dc_08.o1",
            "daily.dc_08.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_08.explanation",
    },
    {
        "id": "dc_09",
        "topic": "predatory_loan_permissions",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_09.scenario",
        "question_key": "daily.dc_09.question",
        "options_keys": [
            "daily.dc_09.o0",
            "daily.dc_09.o1",
            "daily.dc_09.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_09.explanation",
    },
    {
        "id": "dc_10",
        "topic": "secondary_id_harvesting",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_10.scenario",
        "question_key": "daily.dc_10.question",
        "options_keys": [
            "daily.dc_10.o0",
            "daily.dc_10.o1",
            "daily.dc_10.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_10.explanation",
    },
    {
        "id": "dc_11",
        "topic": "qr_code_quishing",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_11.scenario",
        "question_key": "daily.dc_11.question",
        "options_keys": [
            "daily.dc_11.o0",
            "daily.dc_11.o1",
            "daily.dc_11.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_11.explanation",
    },
    {
        "id": "dc_12",
        "topic": "emergency_friend_pretext",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_12.scenario",
        "question_key": "daily.dc_12.question",
        "options_keys": [
            "daily.dc_12.o0",
            "daily.dc_12.o1",
            "daily.dc_12.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_12.explanation",
    },
    {
        "id": "dc_13",
        "topic": "totp_authenticator_defense",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_13.scenario",
        "question_key": "daily.dc_13.question",
        "options_keys": [
            "daily.dc_13.o0",
            "daily.dc_13.o1",
            "daily.dc_13.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_13.explanation",
    },
    {
        "id": "dc_14",
        "topic": "evidence_preservation_dossier",
        "badge_id": "badge_daily_defender",
        "xp_reward": 50,
        "scenario_key": "daily.dc_14.scenario",
        "question_key": "daily.dc_14.question",
        "options_keys": [
            "daily.dc_14.o0",
            "daily.dc_14.o1",
            "daily.dc_14.o2",
        ],
        "correct_choice": 1,
        "explanation_key": "daily.dc_14.explanation",
    },
]


def get_daily_challenge_for_date(date_str: str) -> Dict[str, Any]:
    """Deterministically select a challenge based on YYYY-MM-DD date string."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        dt = datetime.now(timezone.utc)

    day_of_year = dt.timetuple().tm_yday
    idx = day_of_year % len(DAILY_CHALLENGES)
    challenge = DAILY_CHALLENGES[idx].copy()
    challenge["date"] = dt.strftime("%Y-%m-%d")
    return challenge
