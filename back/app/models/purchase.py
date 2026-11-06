from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[int] = mapped_column(Integer, index=True)
    notes: Mapped[str | None] = mapped_column(String(255), default=None)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)

    supplier: Mapped["Supplier"] = relationship(back_populates="purchases")
    items: Mapped[list["PurchaseItem"]] = relationship(
        back_populates="purchase",
        cascade="all, delete-orphan",
    )
    payments: Mapped[list["PurchasePayment"]] = relationship(
        back_populates="purchase",
        cascade="all, delete-orphan",
    )
    cash_movements: Mapped[list["CashMovement"]] = relationship(back_populates="purchase")
