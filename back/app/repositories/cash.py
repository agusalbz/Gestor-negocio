from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cash_closing import CashClosing
from app.models.cash_movement import CashMovement


class CashRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_active_session(self) -> CashClosing | None:
        stmt = (
            select(CashClosing)
            .where(CashClosing.is_closed.is_(False))
            .order_by(CashClosing.opened_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def create_closing(self, closing: CashClosing) -> CashClosing:
        self.db.add(closing)
        self.db.flush()
        self.db.refresh(closing)
        return closing

    def get_closing_by_id(self, closing_id: int) -> CashClosing | None:
        return self.db.get(CashClosing, closing_id)

    def list_closings(self, limit: int = 50) -> list[CashClosing]:
        stmt = (
            select(CashClosing)
            .where(CashClosing.is_closed.is_(True))
            .order_by(CashClosing.closed_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def create_movement(self, movement: CashMovement) -> CashMovement:
        self.db.add(movement)
        self.db.flush()
        self.db.refresh(movement)
        return movement

    def list_movements(self, limit: int = 100) -> list[CashMovement]:
        stmt = (
            select(CashMovement)
            .order_by(CashMovement.moved_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def get_movements_since(self, since: datetime) -> list[CashMovement]:
        stmt = (
            select(CashMovement)
            .where(CashMovement.moved_at >= since)
            .order_by(CashMovement.moved_at.asc())
        )
        return list(self.db.scalars(stmt).all())
