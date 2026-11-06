from app.core.constants import (
    CASH_MOVEMENT_OUT,
    PAYMENT_METHOD_CASH,
    PURCHASE_STATUS_CREDIT,
    PURCHASE_STATUS_PAID,
    PURCHASE_STATUS_PARTIAL,
)
from app.models.cash_movement import CashMovement
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.purchase_item import PurchaseItem
from app.models.purchase_payment import PurchasePayment
from app.models.stock_movement import StockMovement
from app.models.supplier import Supplier
from app.repositories.purchases import PurchaseRepository
from app.schemas.purchase import PurchaseCreate, PurchasePaymentCreate
from sqlalchemy.orm import Session


class PurchaseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = PurchaseRepository(db)

    def _build_summary(self, purchase: Purchase) -> dict:
        total_amount = float(purchase.total_amount)
        total_paid = float(sum(float(p.amount) for p in purchase.payments))
        balance = round(total_amount - total_paid, 2)
        if balance <= 0.009:
            status = PURCHASE_STATUS_PAID
        elif total_paid > 0.009:
            status = PURCHASE_STATUS_PARTIAL
        else:
            status = PURCHASE_STATUS_CREDIT
        return {
            "total_amount": total_amount,
            "total_paid": total_paid,
            "balance": max(0.0, balance),
            "status": status,
        }

    def _serialize_purchase(self, purchase: Purchase) -> dict:
        summary = self._build_summary(purchase)
        purchase.status = summary["status"]
        return {
            "id": purchase.id,
            "purchased_at": purchase.purchased_at,
            "invoice_number": purchase.invoice_number,
            "total_amount": float(purchase.total_amount),
            "status": purchase.status,
            "notes": purchase.notes,
            "supplier": purchase.supplier,
            "items": purchase.items,
            "payments": purchase.payments,
            "summary": summary,
        }

    def get_purchase(self, purchase_id: int) -> dict:
        purchase = self.repository.get_by_id(purchase_id)
        if purchase is None:
            raise LookupError("Compra no encontrada")
        return self._serialize_purchase(purchase)

    def list_purchases(
        self,
        supplier_id: int | None = None,
        status: int | None = None,
    ) -> list[dict]:
        purchases = self.repository.list(supplier_id=supplier_id, status=status)
        return [self._serialize_purchase(p) for p in purchases]

    def create_purchase(self, payload: PurchaseCreate) -> dict:
        supplier = self.db.get(Supplier, payload.supplier_id)
        if supplier is None:
            raise ValueError("Proveedor no encontrado")

        total_amount = 0.0
        items_to_create: list[dict] = []

        for item_data in payload.items:
            product = self.db.get(Product, item_data.product_id)
            if product is None or not product.active:
                raise ValueError(f"Producto con ID {item_data.product_id} no encontrado o inactivo")

            quantity = item_data.quantity
            unit_cost = float(item_data.unit_cost)
            subtotal = round(quantity * unit_cost, 2)
            total_amount += subtotal

            prev_stock = product.stock
            # Increase product stock
            product.stock += quantity
            # Update product cost price if valid cost is given
            if unit_cost > 0:
                product.cost_price = unit_cost

            items_to_create.append(
                {
                    "product": product,
                    "product_id": product.id,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "subtotal": subtotal,
                    "previous_stock": prev_stock,
                    "current_stock": product.stock,
                }
            )

        purchase = Purchase(
            supplier=supplier,
            invoice_number=payload.invoice_number.strip() if payload.invoice_number else None,
            total_amount=round(total_amount, 2),
            status=payload.status,
            notes=payload.notes.strip() if payload.notes else None,
            items=[],
            payments=[],
        )
        self.repository.create(purchase)

        for item_info in items_to_create:
            purchase_item = PurchaseItem(
                purchase=purchase,
                product_id=item_info["product_id"],
                quantity=item_info["quantity"],
                unit_cost=item_info["unit_cost"],
                subtotal=item_info["subtotal"],
            )
            self.db.add(purchase_item)
            self.db.add(
                StockMovement(
                    product_id=item_info["product_id"],
                    movement_type="COMPRA",
                    quantity=item_info["quantity"],
                    previous_stock=item_info["previous_stock"],
                    current_stock=item_info["current_stock"],
                    reference_id=purchase.id,
                    reference_type="purchase",
                    notes=f"Compra #{purchase.id} - Proveedor: {supplier.name}" + (f" (Doc: {purchase.invoice_number})" if purchase.invoice_number else ""),
                )
            )

        # Handle payments
        if payload.status in (PURCHASE_STATUS_PAID, PURCHASE_STATUS_PARTIAL):
            payment_amount = (
                payload.payment.amount
                if (payload.payment and payload.payment.amount is not None)
                else total_amount
            )
            payment_method = (
                payload.payment.payment_method
                if payload.payment
                else PAYMENT_METHOD_CASH
            )

            if payment_amount > 0:
                payment = PurchasePayment(
                    purchase=purchase,
                    amount=payment_amount,
                    payment_method=payment_method,
                )
                self.db.add(payment)

                # If paid with cash, register CashMovement OUT
                if payment_method == PAYMENT_METHOD_CASH:
                    cash_movement = CashMovement(
                        amount=payment_amount,
                        movement_type=CASH_MOVEMENT_OUT,
                        payment_method=payment_method,
                        concept=f"Pago compra #{purchase.id} - {supplier.name}",
                        purchase=purchase,
                    )
                    self.db.add(cash_movement)

        self.db.commit()
        return self.get_purchase(purchase.id)

    def register_payment(self, purchase_id: int, payload: PurchasePaymentCreate) -> dict:
        purchase = self.repository.get_by_id(purchase_id)
        if purchase is None:
            raise LookupError("Compra no encontrada")

        summary = self._build_summary(purchase)
        if summary["balance"] <= 0:
            raise ValueError("La compra ya se encuentra saldada")

        amount = payload.amount if payload.amount is not None else summary["balance"]
        if amount <= 0:
            raise ValueError("El monto debe ser mayor a 0")

        pay_amount = min(amount, summary["balance"])
        payment = PurchasePayment(
            purchase=purchase,
            amount=pay_amount,
            payment_method=payload.payment_method,
        )
        self.repository.add_payment(payment)

        if payload.payment_method == PAYMENT_METHOD_CASH:
            cash_movement = CashMovement(
                amount=pay_amount,
                movement_type=CASH_MOVEMENT_OUT,
                payment_method=payload.payment_method,
                concept=f"Pago cuota compra #{purchase.id} - {purchase.supplier.name}",
                purchase=purchase,
            )
            self.db.add(cash_movement)

        self.db.commit()
        return self.get_purchase(purchase.id)
