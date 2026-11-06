from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SalePayment(Base):
    __tablename__ = "sale_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[int] = mapped_column(Integer, default=0, index=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    is_excess: Mapped[bool] = mapped_column(Boolean, default=False)

    sale: Mapped["Sale"] = relationship(back_populates="payments")
