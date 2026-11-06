from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.category import Category
from app.models.product import Product


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Category]:
        stmt = select(Category).order_by(Category.name.asc())
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, category_id: int) -> Category | None:
        return self.db.get(Category, category_id)

    def get_by_name(self, name: str) -> Category | None:
        stmt = select(Category).where(Category.name == name)
        return self.db.scalar(stmt)

    def create(self, category: Category) -> Category:
        self.db.add(category)
        self.db.flush()
        self.db.refresh(category)
        return category

    def delete(self, category: Category) -> None:
        self.db.delete(category)


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _base_stmt(self) -> Select[tuple[Product]]:
        return select(Product).options(selectinload(Product.categories))

    def list(
        self,
        *,
        search: str | None = None,
        category_id: int | None = None,
        include_inactive: bool = False,
    ) -> list[Product]:
        stmt = self._base_stmt().order_by(Product.name.asc())

        if not include_inactive:
            stmt = stmt.where(Product.active.is_(True))
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(term),
                    Product.sku.ilike(term),
                    Product.barcode.ilike(term),
                )
            )
        if category_id is not None:
            stmt = stmt.where(Product.categories.any(Category.id == category_id))

        return list(self.db.scalars(stmt).all())

    def get_by_id(self, product_id: int) -> Product | None:
        stmt = self._base_stmt().where(Product.id == product_id)
        return self.db.scalar(stmt)

    def get_by_name(self, name: str) -> Product | None:
        stmt = self._base_stmt().where(Product.name == name)
        return self.db.scalar(stmt)

    def create(self, product: Product) -> Product:
        self.db.add(product)
        self.db.flush()
        self.db.refresh(product)
        return product
