import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from . import config
from .cti import canonicalize_url_for_cti, get_cti_adapter
from .ml.m1_url_features import extract_url_feature_dict, extract_url_feature_vector
from .ml.model import SoftmaxClassifier
from .schemas import CTIDetailsResponse, M1CheckRequest, M1CheckResponse

log = logging.getLogger("cybershield")

router = APIRouter(prefix="/api/v1/m1", tags=["m1"])

_m1_model: Optional[SoftmaxClassifier] = None


def get_m1_model() -> Optional[SoftmaxClassifier]:
    global _m1_model
    if _m1_model is None:
        model_path = Path(__file__).resolve().parent / "data" / "ml_m1_url_classifier.json"
        if model_path.is_file():
            _m1_model = SoftmaxClassifier.load(model_path)
    return _m1_model


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
    }


@router.post(
    "/ml-predict",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="Predict URL phishing risk using offline lexical ML classifier",
)
def predict_m1_url_lexical(payload: M1CheckRequest):
    """Offline lexical URL phishing prediction using trained SoftmaxClassifier."""
    model = get_m1_model()
    if model is None:
        raise HTTPException(status_code=503, detail="M1 ML model artifact not loaded")
    raw_url = payload.url.strip()
    features = extract_url_feature_dict(raw_url)
    vec = extract_url_feature_vector(raw_url)
    probs = model.predict_proba(vec)
    pred_class, conf = model.predict(vec)
    # Model produces an uncalibrated softmax lexical risk score based on 12 features.
    # Confidence is uncalibrated and not to be confused with calibrated probability.
    raw_phish = round(probs.get("phishing", 0.0), 4)
    raw_conf = round(conf, 4)
    return {
        "url": raw_url,
        "engine": "ml_url_lexical_v1",
        "predicted_class": pred_class,
        "model_risk_score": raw_phish,
        "phishing_probability": raw_phish,
        "confidence": raw_conf,
        "confidence_calibrated": False,
        "probabilities": {k: round(v, 4) for k, v in probs.items()},
        "features": features,
        "benchmark_metrics": {
            "dataset": "UCI PhiUSIIL Phishing URL Dataset",
            "samples": 1000,
            "test_samples": 200,
            "held_out_accuracy": 0.925,
        },
    }
