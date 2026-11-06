from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.product import Product
from app.models.purchase import Purchase
from app.models.sale import Sale
from app.schemas.reports import ProductPerformanceRead, ProfitabilitySummary


class ReportsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_profitability_summary(self, period: str = "today") -> ProfitabilitySummary:
        now = datetime.utcnow()
        start_date: datetime | None = None
        end_date: datetime | None = now

        if period == "today":
            start_date = datetime(now.year, now.month, now.day, 0, 0, 0)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "all":
            start_date = None
        else:
            period = "today"
            start_date = datetime(now.year, now.month, now.day, 0, 0, 0)

        # 1. Fetch Sales in period
        sales_stmt = select(Sale).options(
            joinedload(Sale.items),
            joinedload(Sale.client),
        )
        if start_date:
            sales_stmt = sales_stmt.where(Sale.sold_at >= start_date)
        sales = list(self.db.scalars(sales_stmt.order_by(Sale.sold_at.desc())).unique())

        total_sales_revenue = 0.0
        total_cost_of_sales = 0.0
        product_perf: dict[int, dict] = {}

        # Pre-load active products for cost lookup
        all_products = {p.id: p for p in self.db.scalars(select(Product)).all()}

        for sale in sales:
            total_sales_revenue += float(sale.total_amount)
            for item in sale.items:
                prod = all_products.get(item.product_id)
                prod_cost = float(prod.cost_price) if prod and prod.cost_price else 0.0
                prod_name = prod.name if prod else f"Producto #{item.product_id}"
                prod_sku = prod.sku if prod else None

                item_rev = float(item.subtotal)
                item_cost = round(item.quantity * prod_cost, 2)
                total_cost_of_sales += item_cost

                if item.product_id not in product_perf:
                    product_perf[item.product_id] = {
                        "product_id": item.product_id,
                        "product_name": prod_name,
                        "sku": prod_sku,
                        "quantity_sold": 0,
                        "total_revenue": 0.0,
                        "total_cost": 0.0,
                    }

                product_perf[item.product_id]["quantity_sold"] += item.quantity
                product_perf[item.product_id]["total_revenue"] += item_rev
                product_perf[item.product_id]["total_cost"] += item_cost

        gross_profit = round(total_sales_revenue - total_cost_of_sales, 2)
        profit_margin_percent = (
            round((gross_profit / total_sales_revenue) * 100, 2)
            if total_sales_revenue > 0
            else 0.0
        )

        # 2. Fetch Purchases in period
        purchases_stmt = select(Purchase)
        if start_date:
            purchases_stmt = purchases_stmt.where(Purchase.purchased_at >= start_date)
        purchases = list(self.db.scalars(purchases_stmt).all())
        total_purchases_expense = round(sum(float(p.total_amount) for p in purchases), 2)
        total_purchases_count = len(purchases)

        # 3. Current Inventory Valuation
        active_products = [p for p in all_products.values() if p.active]
        inventory_cost_value = round(
            sum(max(0, p.stock) * float(p.cost_price) for p in active_products), 2
        )
        inventory_sale_value = round(
            sum(max(0, p.stock) * float(p.price) for p in active_products), 2
        )
        potential_inventory_profit = round(inventory_sale_value - inventory_cost_value, 2)
        low_stock_count = sum(1 for p in active_products if p.stock <= p.min_stock)

        # 4. Product rankings
        perf_list: list[ProductPerformanceRead] = []
        for data in product_perf.values():
            p_profit = round(data["total_revenue"] - data["total_cost"], 2)
            p_margin = (
                round((p_profit / data["total_revenue"]) * 100, 2)
                if data["total_revenue"] > 0
                else 0.0
            )
            perf_list.append(
                ProductPerformanceRead(
                    product_id=data["product_id"],
                    product_name=data["product_name"],
                    sku=data["sku"],
                    quantity_sold=data["quantity_sold"],
                    total_revenue=round(data["total_revenue"], 2),
                    total_cost=round(data["total_cost"], 2),
                    gross_profit=p_profit,
                    profit_margin_percent=p_margin,
                )
            )

        top_selling = sorted(perf_list, key=lambda x: x.quantity_sold, reverse=True)[:10]
        top_profitable = sorted(perf_list, key=lambda x: x.gross_profit, reverse=True)[:10]

        return ProfitabilitySummary(
            period=period,
            start_date=start_date,
            end_date=end_date,
            total_sales_revenue=round(total_sales_revenue, 2),
            total_cost_of_sales=round(total_cost_of_sales, 2),
            gross_profit=gross_profit,
            profit_margin_percent=profit_margin_percent,
            total_sales_count=len(sales),
            total_purchases_expense=total_purchases_expense,
            total_purchases_count=total_purchases_count,
            inventory_cost_value=inventory_cost_value,
            inventory_sale_value=inventory_sale_value,
            potential_inventory_profit=potential_inventory_profit,
            low_stock_count=low_stock_count,
            top_selling_products=top_selling,
            top_profitable_products=top_profitable,
        )
