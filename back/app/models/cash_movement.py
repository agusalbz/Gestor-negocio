from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CashMovement(Base):
    __tablename__ = "cash_movements"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_cash_movements_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    moved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    movement_type: Mapped[int] = mapped_column(Integer, index=True)
    payment_method: Mapped[int] = mapped_column(Integer, index=True)
    concept: Mapped[str] = mapped_column(String(255))
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id"), default=None, index=True)
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey("purchases.id"), default=None, index=True)

    sale: Mapped["Sale | None"] = relationship(back_populates="cash_movements")
    purchase: Mapped["Purchase | None"] = relationship(back_populates="cash_movements")
