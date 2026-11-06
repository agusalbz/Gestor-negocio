from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.client import ClientRead
from app.schemas.product import ProductSummaryRead


class SaleClientInput(BaseModel):
    dni: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def validate_client_payload(self) -> "SaleClientInput":
        if self.dni and not self.name:
            raise ValueError("Si se envia DNI del cliente tambien debe enviarse nombre")
        return self


class SaleItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    discount_rate: float = Field(default=0.0, ge=0.0, le=100.0)


class SalePaymentInput(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    payment_method: int = Field(ge=0)


class SaleCreate(BaseModel):
    status: int = Field(ge=0, le=2)
    items: list[SaleItemCreate] = Field(min_length=1)
    client_id: int | None = Field(default=None, gt=0)
    client: SaleClientInput | None = None
    payment: SalePaymentInput | None = None

    @model_validator(mode="after")
    def validate_payment_rules(self) -> "SaleCreate":
        if self.client_id is not None and self.client is not None:
            raise ValueError("No se puede enviar client_id y client al mismo tiempo")
        if self.status in {1, 2} and self.payment is None:
            raise ValueError("Las ventas parciales o pagadas requieren datos de pago")
        return self


class SalePaymentCreate(BaseModel):
    payment_method: int = Field(ge=0)
    amount: float | None = Field(default=None, gt=0)


class SaleSummary(BaseModel):
    total_amount: float
    total_paid: float
    balance: float
    status: int


class SaleItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quantity: int
    unit_price: float
    discount_rate: float = 0.0
    subtotal: float
    product: ProductSummaryRead


class SalePaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    payment_method: int = 0
    paid_at: datetime
    is_excess: bool


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sold_at: datetime
    total_amount: float
    status: int
    client: ClientRead | None
    items: list[SaleItemRead]
    payments: list[SalePaymentRead]
    summary: SaleSummary


class PendingSaleRead(BaseModel):
    sale_id: int
    client_label: str
    balance: float
