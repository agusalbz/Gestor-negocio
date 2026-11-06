from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.product_supplier import product_supplier_table


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), default=None)
    email: Mapped[str | None] = mapped_column(String(160), default=None)
    address: Mapped[str | None] = mapped_column(String(255), default=None)

    products: Mapped[list["Product"]] = relationship(
        secondary=product_supplier_table,
        back_populates="suppliers",
    )
    purchases: Mapped[list["Purchase"]] = relationship(back_populates="supplier")
