from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.cash import (
    CashClosingRead,
    CashCloseRequest,
    CashMovementCreate,
    CashMovementRead,
    CashOpenRequest,
    CashStatusRead,
)
from app.services.cash import CashService

router = APIRouter()


@router.get("/status", response_model=CashStatusRead)
def get_cash_status(db: Session = Depends(get_db)) -> CashStatusRead:
    return CashService(db).get_status()


@router.post("/open", response_model=CashClosingRead, status_code=status.HTTP_201_CREATED)
def open_caja(payload: CashOpenRequest, db: Session = Depends(get_db)) -> CashClosingRead:
    try:
        return CashService(db).open_caja(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/close", response_model=CashClosingRead)
def close_caja(payload: CashCloseRequest, db: Session = Depends(get_db)) -> CashClosingRead:
    try:
        return CashService(db).close_caja(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/closings", response_model=list[CashClosingRead])
def list_cash_closings(limit: int = 50, db: Session = Depends(get_db)) -> list[CashClosingRead]:
    return CashService(db).list_closings(limit=limit)


@router.get("/movements", response_model=list[CashMovementRead])
def list_cash_movements(limit: int = 100, db: Session = Depends(get_db)) -> list[CashMovementRead]:
    return CashService(db).list_movements(limit=limit)


@router.post("/movements", response_model=CashMovementRead, status_code=status.HTTP_201_CREATED)
def create_cash_movement(payload: CashMovementCreate, db: Session = Depends(get_db)) -> CashMovementRead:
    return CashService(db).create_movement(payload)
