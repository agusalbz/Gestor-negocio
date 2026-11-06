from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CashClosing(Base):
    __tablename__ = "cash_closings"

    id: Mapped[int] = mapped_column(primary_key=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None, index=True)
    opening_cash: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    cash_sales: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    debit_sales: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    credit_sales: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    transfer_sales: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    manual_in: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    manual_out: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    expected_cash: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    counted_cash: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True, default=None)
    difference: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True, default=None)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
