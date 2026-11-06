from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.stock_movement import StockMovement


class StockMovementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, movement: StockMovement) -> StockMovement:
        self.db.add(movement)
        self.db.commit()
        self.db.refresh(movement)
        return movement

    def list_by_product(self, product_id: int, limit: int = 100) -> list[StockMovement]:
        stmt = (
            select(StockMovement)
            .options(joinedload(StockMovement.product))
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def list_all(self, limit: int = 200) -> list[StockMovement]:
        stmt = (
            select(StockMovement)
            .options(joinedload(StockMovement.product))
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())
