"""CyberShield Ethiopia — Journey Artwork API Routes

Endpoints:
- GET  /api/v1/journey/artwork/status: Returns generator availability, active provider, and cache count.
- POST /api/v1/journey/artwork/generate: Resolves scenario artwork via cache, AI generator, or deterministic offline fallback.
"""

import logging
from fastapi import APIRouter, status

from . import config
from .artwork import (
    count_cached_images,
    get_active_provider,
    resolve_artwork,
)
from .schemas import ArtworkGenerateRequest, ArtworkGenerateResponse, ArtworkStatusResponse

log = logging.getLogger("cybershield")

router = APIRouter(prefix="/api/v1/journey/artwork", tags=["journey_artwork"])


@router.get(
    "/status",
    response_model=ArtworkStatusResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Get dynamic AI artwork generator status and cache metrics",
)
def artwork_status():
    """Returns AI generator configuration status without exposing API keys or secrets."""
    provider = get_active_provider()
    configured = provider.is_configured()
    count = count_cached_images()

    msg = "AI generation enabled and ready" if (config.AI_ARTWORK_ENABLED and configured) else "Offline fallback active (AI unconfigured)"

    return ArtworkStatusResponse(
        enabled=config.AI_ARTWORK_ENABLED,
        configured=configured,
        provider=provider.name,
        cached_images_count=count,
        message=msg,
    )


@router.post(
    "/generate",
    response_model=ArtworkGenerateResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Generate or retrieve artwork for a validated scenario",
)
async def generate_artwork(payload: ArtworkGenerateRequest):
    """Derives or retrieves scenario artwork.
    
    Security & Privacy:
    - Never accepts raw user input, passwords, or scanned URLs (enforced by Pydantic schema).
    - Checks local disk cache first.
    - If provider is unconfigured, disabled, or fails, immediately returns deterministic offline fallback.
    - Never blocks gameplay.
    """
    result = await resolve_artwork(payload)
    log.info(
        "event=journey_artwork_request mission_id=%s status=%s provider=%s cached=%s",
        result.mission_id,
        result.status,
        result.provider,
        result.cached,
    )
    return result
