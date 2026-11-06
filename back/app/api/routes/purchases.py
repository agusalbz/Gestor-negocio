from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.purchase import PurchaseCreate, PurchasePaymentCreate, PurchaseRead
from app.services.purchases import PurchaseService

router = APIRouter()


@router.get("/", response_model=list[PurchaseRead])
def list_purchases(
    supplier_id: int | None = None,
    status_filter: int | None = None,
    db: Session = Depends(get_db),
) -> list[PurchaseRead]:
    return PurchaseService(db).list_purchases(supplier_id=supplier_id, status=status_filter)


@router.get("/{purchase_id}", response_model=PurchaseRead)
def get_purchase(purchase_id: int, db: Session = Depends(get_db)) -> PurchaseRead:
    try:
        return PurchaseService(db).get_purchase(purchase_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/", response_model=PurchaseRead, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)) -> PurchaseRead:
    try:
        return PurchaseService(db).create_purchase(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{purchase_id}/payments", response_model=PurchaseRead)
def register_purchase_payment(
    purchase_id: int,
    payload: PurchasePaymentCreate,
    db: Session = Depends(get_db),
) -> PurchaseRead:
    try:
        return PurchaseService(db).register_payment(purchase_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
