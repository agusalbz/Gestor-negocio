from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.stock_movement import StockAdjustmentCreate, StockMovementRead
from app.services.catalog import ProductService

router = APIRouter()


@router.get("/", response_model=list[ProductRead])
def list_products(
    search: str | None = None,
    category_id: int | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[ProductRead]:
    return ProductService(db).list_products(
        search=search,
        category_id=category_id,
        include_inactive=include_inactive,
    )


@router.get("/stock-movements", response_model=list[StockMovementRead])
def list_all_stock_movements(
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[StockMovementRead]:
    return ProductService(db).list_stock_movements(limit=limit)


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)) -> ProductRead:
    try:
        return ProductService(db).get_product(product_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)) -> ProductRead:
    try:
        return ProductService(db).create_product(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
) -> ProductRead:
    try:
        return ProductService(db).update_product(product_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        ProductService(db).delete_product(product_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{product_id}/kardex", response_model=list[StockMovementRead])
def get_product_kardex(
    product_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[StockMovementRead]:
    try:
        return ProductService(db).get_product_kardex(product_id, limit=limit)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{product_id}/adjust-stock")
def adjust_product_stock(
    product_id: int,
    payload: StockAdjustmentCreate,
    db: Session = Depends(get_db),
) -> dict:
    try:
        result = ProductService(db).adjust_stock(product_id, payload)
        return {
            "product": ProductRead.model_validate(result["product"]),
            "movement": result["movement"],
        }
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

