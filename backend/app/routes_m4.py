"""CyberShield Ethiopia — M4 Website Security Check (Demo) Routes.

Provides endpoints for listing simulated website scenarios and retrieving
bundled architectural security findings (TLS, HSTS, CSP, etc.).
No live outbound network code or external web crawling lives here (SR-06).
"""

import sys
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import demo_data

router = APIRouter(prefix="/api/v1/m4", tags=["m4"])


class DemoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: str = Field(max_length=16)


def _get_scenarios():
    main_mod = sys.modules.get("app.main")
    if main_mod is not None and hasattr(main_mod, "SCENARIOS"):
        return main_mod.SCENARIOS
    return demo_data.SCENARIOS


@router.get("/scenarios", summary="List bundled SIMULATED demo scenarios")
def scenarios():
    scenarios_dict = _get_scenarios()
    return {"simulated": True, "scenarios": [{"id": k, "hostname": v["hostname"]} for k, v in scenarios_dict.items()]}


@router.post("/demo", summary="Return SIMULATED fixture findings for an enumerated scenario id")
def demo(body: DemoRequest):
    scenarios_dict = _get_scenarios()
    s = scenarios_dict.get(body.scenario_id)
    if s is None:
        return JSONResponse({"error": {"code": "INVALID_SCENARIO"}}, status_code=400)
    return {"simulated": True, "scenario_id": body.scenario_id, "hostname": s["hostname"], "findings": s["findings"]}
