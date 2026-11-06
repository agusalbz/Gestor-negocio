from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PurchasePayment(Base):
    __tablename__ = "purchase_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[int] = mapped_column(Integer, default=0, index=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    purchase: Mapped["Purchase"] = relationship(back_populates="payments")
