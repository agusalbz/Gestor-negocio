from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductSummaryRead
from app.schemas.supplier import SupplierRead


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: float = Field(ge=0.0)


class PurchaseItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_cost: float
    subtotal: float
    product: ProductSummaryRead


class PurchasePaymentCreate(BaseModel):
    amount: float | None = None
    payment_method: int = 0


class PurchasePaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    payment_method: int
    paid_at: datetime


class PurchaseCreate(BaseModel):
    supplier_id: int
    invoice_number: str | None = None
    status: int = 2
    notes: str | None = None
    items: list[PurchaseItemCreate] = Field(min_length=1)
    payment: PurchasePaymentCreate | None = None


class PurchaseSummaryRead(BaseModel):
    total_amount: float
    total_paid: float
    balance: float
    status: int


class PurchaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchased_at: datetime
    invoice_number: str | None
    total_amount: float
    status: int
    notes: str | None
    supplier: SupplierRead
    items: list[PurchaseItemRead]
    payments: list[PurchasePaymentRead]
    summary: PurchaseSummaryRead
