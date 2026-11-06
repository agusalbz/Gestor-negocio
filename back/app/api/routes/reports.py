from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.reports import ProfitabilitySummary
from app.services.reports import ReportsService

router = APIRouter()


@router.get("/profitability", response_model=ProfitabilitySummary)
def get_profitability_summary(
    period: str = "today",
    db: Session = Depends(get_db),
) -> ProfitabilitySummary:
    return ReportsService(db).get_profitability_summary(period=period)
