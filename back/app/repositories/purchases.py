from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.purchase import Purchase
from app.models.purchase_payment import PurchasePayment


class PurchaseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, purchase_id: int) -> Purchase | None:
        statement = (
            select(Purchase)
            .where(Purchase.id == purchase_id)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items),
                joinedload(Purchase.payments),
            )
        )
        return self.db.scalars(statement).unique().first()

    def create(self, purchase: Purchase) -> Purchase:
        self.db.add(purchase)
        self.db.flush()
        return purchase

    def list(
        self,
        supplier_id: int | None = None,
        status: int | None = None,
    ) -> list[Purchase]:
        statement = (
            select(Purchase)
            .options(
                joinedload(Purchase.supplier),
                joinedload(Purchase.items),
                joinedload(Purchase.payments),
            )
            .order_by(Purchase.purchased_at.desc())
        )
        if supplier_id is not None:
            statement = statement.where(Purchase.supplier_id == supplier_id)
        if status is not None:
            statement = statement.where(Purchase.status == status)

        return list(self.db.scalars(statement).unique().all())

    def add_payment(self, payment: PurchasePayment) -> PurchasePayment:
        self.db.add(payment)
        self.db.flush()
        return payment
