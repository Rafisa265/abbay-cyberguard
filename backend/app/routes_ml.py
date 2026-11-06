"""
CyberShield Ethiopia - Machine Learning API Routes

Endpoints for personalized Journey learning recommendations and ML system status.
"""

import logging
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from .ml.features import JourneyLearningTelemetry
from .ml.service import (
    RecommendationResponse,
    get_adaptive_recommendation,
    get_ml_status,
)

log = logging.getLogger("cybershield")
router = APIRouter(prefix="/api/v1/ml", tags=["Machine Learning"], include_in_schema=False)


@router.post(
    "/recommend",
    response_model=RecommendationResponse,
    summary="Get personalized Journey adaptive learning recommendation",
    description=(
        "Consumes non-sensitive learning telemetry (recent answer outcomes, category/difficulty statistics) "
        "and returns an ML-driven or deterministic fallback difficulty and category recommendation. "
        "Never processes personal data, passwords, or visited URLs."
    ),
)
async def recommend_journey_challenge(
    telemetry: JourneyLearningTelemetry,
    request: Request,
):
    try:
        # Check for controlled test trial authorization via header or query parameter
        is_trial = (
            request.headers.get("X-CyberShield-ML-Trial", "").lower() == "true"
            or request.query_params.get("trial", "").lower() == "true"
        )
        enabled = True if is_trial else None
        rec = get_adaptive_recommendation(telemetry, enabled=enabled)
        log.info(
            "event=ml_recommendation engine=%s diff=%s confidence=%.2f is_trial=%s",
            rec.engine,
            rec.recommended_difficulty,
            rec.confidence,
            is_trial,
        )
        return rec
    except Exception as exc:
        log.error("event=ml_recommendation_error err=%s", str(exc))
        # Ensure zero downtime: fallback response
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "recommended_difficulty": "beginner",
                "recommended_category": None,
                "recommended_module": "m5",
                "recommended_activity": "practice_mission",
                "engine": "deterministic_fallback",
                "confidence": 1.0,
                "probabilities": {"beginner": 1.0, "intermediate": 0.0, "advanced": 0.0},
                "reason": "fallback_on_unhandled_exception",
                "features": {},
                "offline_capable": True,
                "dataset_limitation": "Error fallback triggered. Deterministic safety path engaged.",
            },
        )


@router.get(
    "/status",
    summary="Machine Learning engine status and privacy compliance audit",
)
async def ml_status():
    return get_ml_status()
