from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    price: float = Field(gt=0)
    cost_price: float = Field(default=0.0, ge=0)
    stock: int = Field(ge=0)
    min_stock: int = Field(default=5, ge=0)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    active: bool = True
    category_ids: list[int] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    price: float | None = Field(default=None, gt=0)
    cost_price: float | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    min_stock: int | None = Field(default=None, ge=0)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    active: bool | None = None
    category_ids: list[int] | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
    cost_price: float
    stock: int
    min_stock: int
    sku: str | None
    barcode: str | None
    active: bool
    categories: list[CategoryRead]


class ProductSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
    stock: int
    min_stock: int
    sku: str | None
    barcode: str | None
    active: bool

