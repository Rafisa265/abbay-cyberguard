import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from . import config
from .cti import canonicalize_url_for_cti, get_cti_adapter
from .schemas import CTIDetailsResponse, M1CheckRequest, M1CheckResponse

log = logging.getLogger("cybershield")

router = APIRouter(prefix="/api/v1/m1", tags=["m1"])


@router.post(
    "/check",
    response_model=M1CheckResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Check URL reputation against configured CTI provider",
)
def check_url_reputation(payload: M1CheckRequest):
    """M1 CTI reputation check.
    
    Security & Privacy:
    - Never visits, crawls, or opens the URL.
    - SSRF prevention: backend only queries fixed provider endpoints.
    - Strips sensitive credentials/fragments before querying.
    - Returns standardized CTIResult: known_malicious, no_threat_found, or unavailable.
    - Does not log URL query parameters or passwords.
    """
    raw_url = payload.url.strip()
    try:
        canonical_url = canonicalize_url_for_cti(raw_url)
    except ValueError as e:
        log.warning("event=m1_cti_validation outcome=rejected")
        return JSONResponse(
            {"error": {"code": "INVALID_REQUEST", "detail": str(e)}},
            status_code=400,
        )

    adapter = get_cti_adapter()
    cti_result = adapter.check_url(canonical_url)

    # Log hygiene: log event and outcome without logging raw user URL or credentials
    log.info(
        "event=m1_cti_check provider=%s outcome=%s",
        cti_result.provider,
        cti_result.status,
    )

    return M1CheckResponse(
        url=raw_url,
        canonical_url=canonical_url,
        cti=CTIDetailsResponse(
            provider=cti_result.provider,
            status=cti_result.status,
            threat_types=cti_result.threat_types,
            details=cti_result.details,
            unavailable_reason=cti_result.unavailable_reason,
            source=cti_result.source,
            checked_at=cti_result.checked_at,
            feed_updated_at=cti_result.feed_updated_at,
        ),
    )


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Get M1 CTI capability and provider status",
)
def cti_status():
    """Returns CTI provider name and configuration status without leaking API keys."""
    adapter = get_cti_adapter()
    return {
        "provider": adapter.name,
        "configured": adapter.is_configured(),
        "educational_prototype": True,
        "commercial_alternative": "google_web_risk",
    }
