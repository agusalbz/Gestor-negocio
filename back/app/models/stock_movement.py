from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(32), index=True)  # VENTA, COMPRA, AJUSTE_INGRESO, AJUSTE_EGRESO, RECUENTO, MERMA, ROTURA, DEVOLUCION, INICIAL
    quantity: Mapped[int] = mapped_column(Integer)  # delta (e.g. -2, +10)
    previous_stock: Mapped[int] = mapped_column(Integer)
    current_stock: Mapped[int] = mapped_column(Integer)
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # sale_id, purchase_id
    reference_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # sale, purchase, manual
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="stock_movements")
