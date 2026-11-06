from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClientBase(BaseModel):
    dni: str | None = Field(default=None, max_length=32)
    name: str = Field(min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    active: bool = True


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    dni: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    active: bool | None = None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dni: str | None
    name: str
    phone: str | None
    active: bool
    total_debt: float = 0.0


class ClientPaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    payment_method: int = 0
    sale_id: int | None = None
    notes: str | None = None


class ClientPendingSaleRead(BaseModel):
    sale_id: int
    sold_at: datetime
    total_amount: float
    total_paid: float
    balance: float


class ClientPaymentHistoryRead(BaseModel):
    id: int
    sale_id: int
    amount: float
    payment_method: int
    paid_at: datetime


class ClientAccountRead(BaseModel):
    client: ClientRead
    total_debt: float
    pending_sales: list[ClientPendingSaleRead]
    recent_payments: list[ClientPaymentHistoryRead]
