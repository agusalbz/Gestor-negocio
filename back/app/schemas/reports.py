from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ProductPerformanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    product_name: str
    sku: str | None = None
    quantity_sold: int
    total_revenue: float
    total_cost: float
    gross_profit: float
    profit_margin_percent: float


class ProfitabilitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: str
    start_date: datetime | None = None
    end_date: datetime | None = None
    total_sales_revenue: float
    total_cost_of_sales: float
    gross_profit: float
    profit_margin_percent: float
    total_sales_count: int
    total_purchases_expense: float
    total_purchases_count: int
    inventory_cost_value: float
    inventory_sale_value: float
    potential_inventory_profit: float
    low_stock_count: int
    top_selling_products: list[ProductPerformanceRead]
    top_profitable_products: list[ProductPerformanceRead]
