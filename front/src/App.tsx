import { FormEvent, useEffect, useMemo, useState, useRef } from "react";

import { AppProviders } from "./app/AppProviders";
import { appRoutes } from "./app/router";
import { ShellLayout } from "./layouts/ShellLayout";
import { API_URL, apiGet, apiPost, apiPatch } from "./shared/api/client";

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  sku: string | null;
  barcode: string | null;
  active: boolean;
  categories: Category[];
};

type Client = {
  id: number;
  dni: string | null;
  name: string;
  phone: string | null;
  active: boolean;
  total_debt?: number;
};

type ClientPendingSale = {
  sale_id: number;
  sold_at: string;
  total_amount: number;
  total_paid: number;
  balance: number;
};

type ClientPaymentHistory = {
  id: number;
  sale_id: number;
  amount: number;
  payment_method: number;
  paid_at: string;
};

type ClientAccount = {
  client: Client;
  total_debt: number;
  pending_sales: ClientPendingSale[];
  recent_payments: ClientPaymentHistory[];
};

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  products: Product[];
};

type PurchaseItem = {
  id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  product: Product;
};

type PurchasePayment = {
  id: number;
  amount: number;
  payment_method: number;
  paid_at: string;
};

type Purchase = {
  id: number;
  purchased_at: string;
  invoice_number: string | null;
  total_amount: number;
  status: number;
  notes: string | null;
  supplier: Supplier;
  items: PurchaseItem[];
  payments: PurchasePayment[];
  summary: {
    total_amount: number;
    total_paid: number;
    balance: number;
    status: number;
  };
};

type SaleItem = {
  id: number;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  subtotal: number;
  product: Product;
};

type SalePayment = {
  id: number;
  amount: number;
  payment_method: number;
  paid_at: string;
  is_excess: boolean;
};

type Sale = {
  id: number;
  sold_at: string;
  total_amount: number;
  status: number;
  client: Client | null;
  items: SaleItem[];
  payments: SalePayment[];
  summary: {
    total_amount: number;
    total_paid: number;
    balance: number;
    status: number;
  };
};

type Loadable<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type StockMovement = {
  id: number;
  product_id: number;
  product_name?: string | null;
  product_sku?: string | null;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  reference_id?: number | null;
  reference_type?: string | null;
  notes?: string | null;
  created_at: string;
};

type ProductPerformance = {
  product_id: number;
  product_name: string;
  sku?: string | null;
  quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  profit_margin_percent: number;
};

type ProfitabilitySummary = {
  period: string;
  start_date?: string | null;
  end_date?: string | null;
  total_sales_revenue: number;
  total_cost_of_sales: number;
  gross_profit: number;
  profit_margin_percent: number;
  total_sales_count: number;
  total_purchases_expense: number;
  total_purchases_count: number;
  inventory_cost_value: number;
  inventory_sale_value: number;
  potential_inventory_profit: number;
  low_stock_count: number;
  top_selling_products: ProductPerformance[];
  top_profitable_products: ProductPerformance[];
};

type CajaStatus = {
  is_open: boolean;
  active_session_id: number | null;
  opened_at: string | null;
  opening_cash: number;
  cash_sales: number;
  debit_sales: number;
  credit_sales: number;
  transfer_sales: number;
  manual_in: number;
  manual_out: number;
  expected_cash: number;
  total_sales: number;
};

type CajaClosing = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  cash_sales: number;
  debit_sales: number;
  credit_sales: number;
  transfer_sales: number;
  manual_in: number;
  manual_out: number;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  notes: string | null;
  is_closed: boolean;
};

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  currency: "ARS",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const saleStatuses = ["Pendiente", "Parcial", "Pagada"];
const purchaseStatuses = ["A Pagar", "Parcial", "Pagada"];
const paymentMethods = ["Efectivo", "Debito", "Credito", "Transferencia"];

const initialLoadable = <T,>(data: T): Loadable<T> => ({
  data,
  error: null,
  loading: true,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getInitialRoute() {
  const hash = window.location.hash.replace("#", "");
  return appRoutes.some((route) => route.key === hash) ? hash : "dashboard";
}

const initialCajaStatus: CajaStatus = {
  is_open: false,
  active_session_id: null,
  opened_at: null,
  opening_cash: 0,
  cash_sales: 0,
  debit_sales: 0,
  credit_sales: 0,
  transfer_sales: 0,
  manual_in: 0,
  manual_out: 0,
  expected_cash: 0,
  total_sales: 0,
};

export default function App() {
  const [activeRoute, setActiveRoute] = useState(getInitialRoute);
  const [products, setProducts] = useState(initialLoadable<Product[]>([]));
  const [clients, setClients] = useState(initialLoadable<Client[]>([]));
  const [suppliers, setSuppliers] = useState(initialLoadable<Supplier[]>([]));
  const [categories, setCategories] = useState(initialLoadable<Category[]>([]));
  const [sales, setSales] = useState(initialLoadable<Sale[]>([]));
  const [cajaStatus, setCajaStatus] = useState(initialLoadable<CajaStatus>(initialCajaStatus));
  const [cajaHistory, setCajaHistory] = useState(initialLoadable<CajaClosing[]>([]));
  const [purchases, setPurchases] = useState(initialLoadable<Purchase[]>([]));
  const [stockMovements, setStockMovements] = useState(initialLoadable<StockMovement[]>([]));
  const [reportPeriod, setReportPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [profitReport, setProfitReport] = useState<ProfitabilitySummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Theme states
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem("theme") as 'light' | 'dark') ?? 'light';
  });
  const [systemThemeSync, setSystemThemeSync] = useState<boolean>(() => {
    return localStorage.getItem("gestock_system_theme") === "true";
  });

  // Settings / Accessibility states
  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem("gestock_accent") ?? "gestock-blue";
  });
  const [daltonism, setDaltonism] = useState<string>(() => {
    return localStorage.getItem("gestock_daltonism") ?? "none";
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem("gestock_high_contrast") === "true";
  });
  const [textScale, setTextScale] = useState<string>(() => {
    return localStorage.getItem("gestock_text_scale") ?? "normal";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Receipt printable data
  const [printReceiptData, setPrintReceiptData] = useState<{ type: 'sale' | 'arqueo' | 'cobranza'; data: any } | null>(null);
  const printButtonRef = useRef<HTMLButtonElement>(null);

  // Global Keyboard Shortcuts (Alt+1..8 to switch views, Esc to close modals)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Escape closes print modal or connection settings
      if (e.key === "Escape") {
        if (printReceiptData) {
          e.preventDefault();
          setPrintReceiptData(null);
        } else if (isSettingsOpen) {
          e.preventDefault();
          setIsSettingsOpen(false);
        }
      }

      // Alt+1 .. Alt+8 navigation across views
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= appRoutes.length) {
          e.preventDefault();
          navigate(appRoutes[num - 1].key);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [printReceiptData, isSettingsOpen]);

  // Autofocus print button when ticket modal opens
  useEffect(() => {
    if (printReceiptData) {
      setTimeout(() => {
        printButtonRef.current?.focus();
      }, 50);
    }
  }, [printReceiptData]);

  // Apply visual settings changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accentColor);
    localStorage.setItem("gestock_accent", accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.setAttribute("data-daltonism", daltonism);
    localStorage.setItem("gestock_daltonism", daltonism);
  }, [daltonism]);

  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", String(highContrast));
    localStorage.setItem("gestock_high_contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute("data-text-scale", textScale);
    localStorage.setItem("gestock_text_scale", textScale);
  }, [textScale]);

  useEffect(() => {
    localStorage.setItem("gestock_system_theme", String(systemThemeSync));
    if (systemThemeSync) {
      const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
        setTheme(e.matches ? "dark" : "light");
      };
      setTheme(matchMedia.matches ? "dark" : "light");
      matchMedia.addEventListener("change", handleSystemThemeChange);
      return () => matchMedia.removeEventListener("change", handleSystemThemeChange);
    }
  }, [systemThemeSync]);

  const refreshData = async () => {
    setProducts((current) => ({ ...current, loading: true, error: null }));
    setClients((current) => ({ ...current, loading: true, error: null }));
    setSuppliers((current) => ({ ...current, loading: true, error: null }));
    setCategories((current) => ({ ...current, loading: true, error: null }));
    setSales((current) => ({ ...current, loading: true, error: null }));
    setPurchases((current) => ({ ...current, loading: true, error: null }));
    setStockMovements((current) => ({ ...current, loading: true, error: null }));
    setCajaStatus((current) => ({ ...current, loading: true, error: null }));
    setCajaHistory((current) => ({ ...current, loading: true, error: null }));

    const loaders = [
      apiGet<Product[]>("/products/").then(
        (data) => setProducts({ data, error: null, loading: false }),
        (error: Error) => setProducts({ data: [], error: error.message, loading: false }),
      ),
      apiGet<StockMovement[]>("/products/stock-movements").then(
        (data) => setStockMovements({ data, error: null, loading: false }),
        (error: Error) => setStockMovements({ data: [], error: error.message, loading: false }),
      ),
      apiGet<ProfitabilitySummary>(`/reports/profitability?period=${reportPeriod}`).then(
        (data) => setProfitReport(data),
        () => setProfitReport(null),
      ),
      apiGet<Client[]>("/clients/").then(
        (data) => setClients({ data, error: null, loading: false }),
        (error: Error) => setClients({ data: [], error: error.message, loading: false }),
      ),
      apiGet<Supplier[]>("/suppliers/").then(
        (data) => setSuppliers({ data, error: null, loading: false }),
        (error: Error) => setSuppliers({ data: [], error: error.message, loading: false }),
      ),
      apiGet<Category[]>("/categories/").then(
        (data) => setCategories({ data, error: null, loading: false }),
        (error: Error) => setCategories({ data: [], error: error.message, loading: false }),
      ),
      apiGet<Sale[]>("/sales/").then(
        (data) => setSales({ data, error: null, loading: false }),
        (error: Error) => setSales({ data: [], error: error.message, loading: false }),
      ),
      apiGet<Purchase[]>("/purchases/").then(
        (data) => setPurchases({ data, error: null, loading: false }),
        (error: Error) => setPurchases({ data: [], error: error.message, loading: false }),
      ),
      apiGet<CajaStatus>("/cash/status").then(
        (data) => setCajaStatus({ data, error: null, loading: false }),
        (error: Error) => setCajaStatus({ data: initialCajaStatus, error: error.message, loading: false }),
      ),
      apiGet<CajaClosing[]>("/cash/closings").then(
        (data) => setCajaHistory({ data, error: null, loading: false }),
        (error: Error) => setCajaHistory({ data: [], error: error.message, loading: false }),
      ),
    ];

    await Promise.all(loaders);
  };

  useEffect(() => {
    apiGet<ProfitabilitySummary>(`/reports/profitability?period=${reportPeriod}`).then(
      (data) => setProfitReport(data),
      () => setProfitReport(null),
    );
  }, [reportPeriod]);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    const syncRoute = () => setActiveRoute(getInitialRoute());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const navigate = (route: string) => {
    window.location.hash = route;
    setActiveRoute(route);
  };

  const dashboard = useMemo(() => {
    const totalStockValue = products.data.reduce((total, product) => total + product.price * product.stock, 0);
    const today = new Date().toDateString();
    const todaySales = sales.data.filter((sale) => new Date(sale.sold_at).toDateString() === today);
    const pendingBalance = sales.data.reduce((total, sale) => total + sale.summary.balance, 0);
    const lowStock = products.data.filter((product) => product.stock <= 5);

    return { lowStock, pendingBalance, todaySales, totalStockValue };
  }, [products.data, sales.data]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const connectionStatus = useMemo(() => {
    const hasError = products.error || clients.error || suppliers.error || categories.error || sales.error || purchases.error;
    const anyLoading = products.loading || clients.loading || suppliers.loading || categories.loading || sales.loading || purchases.loading;
    
    if (hasError) return "error";
    if (anyLoading) return "loading";
    return "connected";
  }, [products, clients, suppliers, categories, sales, purchases]);

  return (
    <AppProviders>
      <ShellLayout activeRoute={activeRoute} onNavigate={navigate}>
        <header className="topbar">
          <div>
            <p className="eyebrow">Panel operativo</p>
            <h2>{appRoutes.find((route) => route.key === activeRoute)?.label ?? "Dashboard"}</h2>
          </div>
          <div className="topbar-actions">
            <div className="topbar-brand">
              <img src="/logo.jpeg" alt="GESTOCK" />
              <span>GESTOCK</span>
            </div>
            <button 
              className={`connection-status-pill ${connectionStatus}`} 
              onClick={() => setIsSettingsOpen(true)}
              title="Ver detalles de conexión"
              type="button"
            >
              <span className="pulse-dot" />
              {connectionStatus === "connected" ? "Conectado" : connectionStatus === "loading" ? "Conectando..." : "Desconectado"}
            </button>
            <button className="icon-button" onClick={() => void refreshData()} title="Actualizar datos" type="button">
              ↻
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        {isSettingsOpen ? (
          <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Configuración de Conexión</h3>
                <button className="close-button" onClick={() => setIsSettingsOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="settings-group">
                  <label>URL del Backend API</label>
                  <input readOnly value={API_URL} className="readonly-input" />
                  <p className="settings-help">Dirección a la que el frontend realiza las peticiones.</p>
                </div>
                <div className="settings-group">
                  <label>Base de Datos Principal</label>
                  <div className="db-status-info">
                    <span className="status-label">SQLite Local:</span>
                    <span className="status-value" style={{ color: connectionStatus === "connected" ? "#10b981" : "#ef4444" }}>
                      {connectionStatus === "connected" ? "Activo (gestor_negocio.db)" : "Inactivo / Desconectado"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="primary-button" onClick={() => setIsSettingsOpen(false)}>Aceptar</button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Printable Ticket Receipt Backdrop Modal */}
        {printReceiptData ? (
          <div className="modal-backdrop print-only-modal" onClick={() => setPrintReceiptData(null)}>
            <div className="modal-content" style={{ width: "90mm", maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header no-print">
                <h3>Comprobante Termico</h3>
                <button className="close-button" onClick={() => setPrintReceiptData(null)}>&times;</button>
              </div>
              <div className="modal-body">
                {printReceiptData.type === "sale" ? (
                  <div className="ticket-print-container">
                    <div className="ticket-header">
                      <h4>GESTOCK</h4>
                      <p>Sistema de Gestión Local</p>
                      <p>Ticket Nro: #{printReceiptData.data.id}</p>
                      <p>Fecha: {formatDate(printReceiptData.data.sold_at)}</p>
                      <p>Cliente: {printReceiptData.data.client?.name ?? "Consumidor Final"}</p>
                      {printReceiptData.data.client?.dni && <p>DNI: {printReceiptData.data.client.dni}</p>}
                    </div>
                    <div className="ticket-divider" />
                    <table className="ticket-table">
                      <thead>
                        <tr>
                          <th>Cant x Desc</th>
                          <th style={{ textAlign: "right" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printReceiptData.data.items.map((item: any) => (
                          <tr key={item.id}>
                            <td>
                              {item.quantity} x {item.product.name}
                              {item.subtotal < (item.unit_price * item.quantity) && (
                                <div style={{ fontSize: "0.75rem", fontStyle: "italic" }}>
                                  Desc. aplicado (orig. {formatMoney(item.unit_price * item.quantity)})
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>{formatMoney(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="ticket-divider" />
                    <div className="ticket-totals">
                      <div>Total: <strong>{formatMoney(printReceiptData.data.total_amount)}</strong></div>
                      <div>Método: {paymentMethods[printReceiptData.data.payments?.[0]?.payment_method ?? 0]}</div>
                    </div>
                    <div className="ticket-footer">
                      <p>¡Gracias por su compra en GESTOCK!</p>
                      <p>Conserve este ticket</p>
                    </div>
                  </div>
                ) : printReceiptData.type === "cobranza" ? (
                  <div className="ticket-print-container">
                    <div className="ticket-header">
                      <h4>GESTOCK</h4>
                      <p>Recibo de Cobranza / Pago a Cuenta</p>
                      <p>Fecha: {formatDate(printReceiptData.data.date)}</p>
                      <p>Cliente: {printReceiptData.data.clientName}</p>
                      {printReceiptData.data.clientDni && <p>DNI: {printReceiptData.data.clientDni}</p>}
                    </div>
                    <div className="ticket-divider" />
                    <table className="ticket-table">
                      <tbody>
                        <tr>
                          <td>Monto Cobrado:</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(printReceiptData.data.amount)}</td>
                        </tr>
                        <tr>
                          <td>Método de Pago:</td>
                          <td style={{ textAlign: "right" }}>{paymentMethods[printReceiptData.data.paymentMethod] ?? "Efectivo"}</td>
                        </tr>
                        {printReceiptData.data.saleId && (
                          <tr>
                            <td>Aplicado a Venta:</td>
                            <td style={{ textAlign: "right" }}>#{printReceiptData.data.saleId}</td>
                          </tr>
                        )}
                        <tr style={{ fontWeight: "bold", borderTop: "1px dashed #000" }}>
                          <td>Saldo Restante:</td>
                          <td style={{ textAlign: "right", color: printReceiptData.data.remainingDebt > 0 ? "red" : "black" }}>
                            {formatMoney(printReceiptData.data.remainingDebt)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="ticket-divider" />
                    <div className="ticket-footer">
                      <p>Comprobante de pago oficial</p>
                      <p>¡Gracias por su pago en GESTOCK!</p>
                    </div>
                  </div>
                ) : (
                  <div className="ticket-print-container">
                    <div className="ticket-header">
                      <h4>GESTOCK</h4>
                      <p>Arqueo Diario de Caja</p>
                      <p>Cierre Nro: #{printReceiptData.data.id}</p>
                      <p>Apertura: {formatDate(printReceiptData.data.opened_at)}</p>
                      <p>Cierre: {formatDate(printReceiptData.data.closed_at || printReceiptData.data.opened_at)}</p>
                    </div>
                    <div className="ticket-divider" />
                    <table className="ticket-table">
                      <tbody>
                        <tr>
                          <td>Fondo Apertura:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.opening_cash)}</td>
                        </tr>
                        <tr>
                          <td>Ventas en Efectivo:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.cash_sales)}</td>
                        </tr>
                        <tr>
                          <td>Ventas Débito:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.debit_sales)}</td>
                        </tr>
                        <tr>
                          <td>Ventas Crédito:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.credit_sales)}</td>
                        </tr>
                        <tr>
                          <td>Ventas Transferencia:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.transfer_sales)}</td>
                        </tr>
                        <tr style={{ fontWeight: "bold" }}>
                          <td>Efectivo Esperado:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.expected_cash)}</td>
                        </tr>
                        <tr style={{ fontWeight: "bold" }}>
                          <td>Efectivo Contado:</td>
                          <td style={{ textAlign: "right" }}>{formatMoney(printReceiptData.data.counted_cash ?? 0)}</td>
                        </tr>
                        <tr style={{ fontWeight: "bold", borderTop: "1px dashed #000" }}>
                          <td>Diferencia:</td>
                          <td style={{ textAlign: "right", color: (printReceiptData.data.difference ?? 0) === 0 ? "black" : (printReceiptData.data.difference ?? 0) > 0 ? "blue" : "red" }}>
                            {formatMoney(printReceiptData.data.difference ?? 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="ticket-divider" />
                    <div className="ticket-footer">
                      <p>Informe de arqueo local diario</p>
                      <p>GESTOCK - Caja Controlada</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer no-print">
                <button ref={printButtonRef} className="primary-button" onClick={() => window.print()}>Imprimir Comprobante [Enter]</button>
                <button className="secondary-button" onClick={() => setPrintReceiptData(null)}>Cerrar [Esc]</button>
              </div>
            </div>
          </div>
        ) : null}

        {activeRoute === "dashboard" ? (
          <DashboardView
            dashboard={dashboard}
            sales={sales}
            profitReport={profitReport}
            reportPeriod={reportPeriod}
            onPeriodChange={setReportPeriod}
          />
        ) : null}
        {activeRoute === "ventas" ? (
          <SalesView
            clients={clients}
            onCreated={(registeredSale) => {
              showNotice("Venta registrada con éxito");
              void refreshData();
              if (registeredSale) {
                setPrintReceiptData({ type: "sale", data: registeredSale });
              }
            }}
            products={products}
            sales={sales}
            cajaStatus={cajaStatus}
          />
        ) : null}
        {activeRoute === "inventario" ? (
          <InventoryView
            categories={categories}
            onCreated={() => {
              showNotice("Inventario actualizado con éxito");
              void refreshData();
            }}
            products={products}
            sales={sales}
            stockMovements={stockMovements}
          />
        ) : null}
        {activeRoute === "caja" ? (
          <CajaView
            cajaStatus={cajaStatus}
            cajaHistory={cajaHistory}
            onRefreshCaja={refreshData}
            onPrintArqueo={(record) => {
              setPrintReceiptData({ type: "arqueo", data: record });
            }}
          />
        ) : null}
        {activeRoute === "clientes" ? (
          <ClientsView
            clients={clients}
            onCreated={() => {
              showNotice("Cliente registrado con éxito");
              void refreshData();
            }}
            onPaymentRegistered={(receiptData) => {
              showNotice("Pago registrado con éxito");
              void refreshData();
              setPrintReceiptData({ type: "cobranza", data: receiptData });
            }}
            cajaStatus={cajaStatus}
          />
        ) : null}
        {activeRoute === "proveedores" ? (
          <SuppliersView
            onCreated={() => {
              showNotice("Operación realizada con éxito");
              void refreshData();
            }}
            products={products}
            suppliers={suppliers}
            purchases={purchases}
            cajaStatus={cajaStatus}
          />
        ) : null}
        {activeRoute === "categorias" ? (
          <CategoriesView
            categories={categories}
            onCreated={() => {
              showNotice("Categoría registrada con éxito");
              void refreshData();
            }}
          />
        ) : null}
        {activeRoute === "ajustes" ? (
          <AjustesView
            theme={theme}
            setTheme={setTheme}
            systemThemeSync={systemThemeSync}
            setSystemThemeSync={setSystemThemeSync}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            daltonism={daltonism}
            setDaltonism={setDaltonism}
            highContrast={highContrast}
            setHighContrast={setHighContrast}
            textScale={textScale}
            setTextScale={setTextScale}
          />
        ) : null}
      </ShellLayout>
    </AppProviders>
  );
}

function DashboardView({
  dashboard,
  sales,
  profitReport,
  reportPeriod,
  onPeriodChange,
}: {
  dashboard: {
    lowStock: Product[];
    pendingBalance: number;
    todaySales: Sale[];
    totalStockValue: number;
  };
  sales: Loadable<Sale[]>;
  profitReport: ProfitabilitySummary | null;
  reportPeriod: "today" | "week" | "month" | "all";
  onPeriodChange: (p: "today" | "week" | "month" | "all") => void;
}) {
  const periodSales = profitReport ? profitReport.total_sales_revenue : dashboard.todaySales.reduce((total, sale) => total + sale.total_amount, 0);
  const periodCost = profitReport ? profitReport.total_cost_of_sales : 0;
  const periodProfit = profitReport ? profitReport.gross_profit : 0;
  const periodMargin = profitReport ? profitReport.profit_margin_percent : 0;
  const stockCostValue = profitReport ? profitReport.inventory_cost_value : 0;
  const stockSaleValue = profitReport ? profitReport.inventory_sale_value : dashboard.totalStockValue;

  return (
    <div className="stack">
      {/* Period Selector Tabs */}
      <div className="tabs-header" style={{ marginBottom: "0px" }}>
        <button
          className={`tab-button ${reportPeriod === "today" ? "active" : ""}`}
          onClick={() => onPeriodChange("today")}
          type="button"
        >
          Hoy
        </button>
        <button
          className={`tab-button ${reportPeriod === "week" ? "active" : ""}`}
          onClick={() => onPeriodChange("week")}
          type="button"
        >
          Últimos 7 días
        </button>
        <button
          className={`tab-button ${reportPeriod === "month" ? "active" : ""}`}
          onClick={() => onPeriodChange("month")}
          type="button"
        >
          Este Mes
        </button>
        <button
          className={`tab-button ${reportPeriod === "all" ? "active" : ""}`}
          onClick={() => onPeriodChange("all")}
          type="button"
        >
          Histórico Total
        </button>
      </div>

      <section className="metric-grid">
        <MetricCard 
          label={`Ventas (${reportPeriod === "today" ? "Hoy" : reportPeriod === "week" ? "7 Días" : reportPeriod === "month" ? "Mes" : "Histórico"})`} 
          value={formatMoney(periodSales)} 
          meta={`${profitReport?.total_sales_count ?? dashboard.todaySales.length} ventas procesadas`} 
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          }
        />
        <MetricCard 
          label="Ganancia Real (Bruta)" 
          value={formatMoney(periodProfit)} 
          meta={`Margen de ganancia: ${periodMargin}%`} 
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          }
        />
        <MetricCard 
          label="Costo de Mercadería" 
          value={formatMoney(periodCost)} 
          meta="Costo de adquisición vendido" 
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          }
        />
        <MetricCard 
          label="Capital en Stock (Costo)" 
          value={formatMoney(stockCostValue)} 
          meta={`Valor de venta: ${formatMoney(stockSaleValue)}`} 
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          }
        />
      </section>

      {/* Rankings Section */}
      {profitReport && (profitReport.top_selling_products.length > 0 || profitReport.top_profitable_products.length > 0) && (
        <section className="panel-grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Top Productos Más Vendidos</h3>
            </div>
            {profitReport.top_selling_products.length === 0 ? (
              <EmptyState message="Sin ventas en este período." />
            ) : (
              <DataTable
                columns={["Producto", "Vendidos", "Recaudación", "Ganancia"]}
                rows={profitReport.top_selling_products.map((p) => [
                  p.product_name,
                  `${p.quantity_sold} u.`,
                  formatMoney(p.total_revenue),
                  formatMoney(p.gross_profit),
                ])}
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Top Productos Más Rentables</h3>
            </div>
            {profitReport.top_profitable_products.length === 0 ? (
              <EmptyState message="Sin ventas en este período." />
            ) : (
              <DataTable
                columns={["Producto", "Ganancia Aportada", "Margen %"]}
                rows={profitReport.top_profitable_products.map((p) => [
                  p.product_name,
                  formatMoney(p.gross_profit),
                  `${p.profit_margin_percent}%`,
                ])}
              />
            )}
          </section>
        </section>
      )}

      <section className="panel-grid">
        <Panel title="Últimas ventas" state={sales}>
          <DataTable
            columns={["Fecha", "Cliente", "Total", "Estado"]}
            rows={sales.data.slice(0, 6).map((sale) => [
              formatDate(sale.sold_at),
              sale.client?.name ?? "Consumidor final",
              formatMoney(sale.total_amount),
              saleStatuses[sale.status] ?? "Sin estado",
            ])}
          />
        </Panel>

        <section className="panel">
          <div className="panel-header">
            <h3>Alertas de stock ({dashboard.lowStock.length})</h3>
          </div>
          {dashboard.lowStock.length === 0 ? (
            <EmptyState message="No hay productos con stock bajo." />
          ) : (
            <div className="compact-list">
              {dashboard.lowStock.slice(0, 8).map((product) => (
                <div className="compact-row" key={product.id}>
                  <span>{product.name}</span>
                  <strong style={{ color: "#ef4444" }}>{product.stock} u.</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function SalesView({
  clients,
  onCreated,
  products,
  sales,
  cajaStatus,
}: {
  clients: Loadable<Client[]>;
  onCreated: (registeredSale: Sale) => void;
  products: Loadable<Product[]>;
  sales: Loadable<Sale[]>;
  cajaStatus: Loadable<CajaStatus>;
}) {
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("0");
  const [status, setStatus] = useState("2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutClientRef = useRef<HTMLSelectElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Cart item management
  type CartItem = {
    product: Product;
    quantity: number;
    discount: number; // percentage
  };
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Filter products by query (name, sku, barcode) with exact barcode prioritization
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matches = products.data.filter((p) => {
      return (
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.name.toLowerCase().includes(q)
      );
    });

    return matches.sort((a, b) => {
      const aBarcodeExact = a.barcode && a.barcode.trim().toLowerCase() === q;
      const bBarcodeExact = b.barcode && b.barcode.trim().toLowerCase() === q;
      if (aBarcodeExact && !bBarcodeExact) return -1;
      if (!aBarcodeExact && bBarcodeExact) return 1;

      const aSkuExact = a.sku && a.sku.trim().toLowerCase() === q;
      const bSkuExact = b.sku && b.sku.trim().toLowerCase() === q;
      if (aSkuExact && !bSkuExact) return -1;
      if (!aSkuExact && bSkuExact) return 1;

      return 0;
    });
  }, [searchQuery, products.data]);

  const addToCart = (product: Product) => {
    if (!product.active) return;
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 <= product.stock) {
          return current.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          alert(`Stock disponible superado para ${product.name} (máx ${product.stock} u.)`);
          return current;
        }
      } else {
        if (product.stock > 0) {
          return [...current, { product, quantity: 1, discount: 0 }];
        } else {
          alert(`El producto "${product.name}" no posee stock disponible.`);
          return current;
        }
      }
    });
    setSearchQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
  };

  const handleBarcodeOrSearchSubmit = (inputRaw: string) => {
    const raw = inputRaw.trim();
    if (!raw) return;

    // Clean non-printable/control chars often emitted by USB barcode readers
    const code = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (!code) return;

    const lowerCode = code.toLowerCase();

    // 1. EXACT match on COMPLETE barcode (case-insensitive)
    const exactBarcode = products.data.find(
      (p) => p.active && p.barcode && p.barcode.trim().toLowerCase() === lowerCode
    );
    if (exactBarcode) {
      addToCart(exactBarcode);
      setSearchQuery("");
      return;
    }

    // 2. EXACT match on COMPLETE SKU
    const exactSku = products.data.find(
      (p) => p.active && p.sku && p.sku.trim().toLowerCase() === lowerCode
    );
    if (exactSku) {
      addToCart(exactSku);
      setSearchQuery("");
      return;
    }

    // 3. If there is a single match in suggestions
    if (suggestions.length === 1 && suggestions[0].active) {
      addToCart(suggestions[0]);
      setSearchQuery("");
      return;
    }

    // 4. If any suggestion matches barcode exactly
    const suggestionExact = suggestions.find(
      (p) => p.active && p.barcode && p.barcode.trim().toLowerCase() === lowerCode
    );
    if (suggestionExact) {
      addToCart(suggestionExact);
      setSearchQuery("");
      return;
    }

    // 5. If query looks like a standard barcode (digits only, length >= 6) and was not found
    if (/^\d{6,}$/.test(code)) {
      alert(`Código de barras completo "${code}" no encontrado en el catálogo.`);
      setSearchQuery("");
      return;
    }

    // 6. If multiple suggestions exist, pick the first active one with available stock
    if (suggestions.length > 0) {
      const firstAvailable = suggestions.find((p) => p.active && p.stock > 0) || suggestions[0];
      if (firstAvailable && firstAvailable.active) {
        addToCart(firstAvailable);
        setSearchQuery("");
        return;
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        const item = suggestions[highlightedIndex];
        if (item.active && item.stock > 0) {
          addToCart(item);
          setHighlightedIndex(-1);
          return;
        }
      }
      handleBarcodeOrSearchSubmit(searchQuery);
      setHighlightedIndex(-1);
    } else if (e.key === "Escape") {
      setSearchQuery("");
      setHighlightedIndex(-1);
    } else if (e.key === "F2") {
      e.preventDefault();
      checkoutClientRef.current?.focus();
    }
  };

  // Barcode scanner listener & global POS hotkeys
  useEffect(() => {
    let buffer = "";
    let lastTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Global POS Shortcuts
      if (activeTab === "pos") {
        if (e.key === "F4") {
          e.preventDefault();
          searchInputRef.current?.focus();
          return;
        }
        if (e.key === "F2") {
          e.preventDefault();
          checkoutClientRef.current?.focus();
          return;
        }
        if (e.ctrlKey && e.key === "Enter") {
          e.preventDefault();
          if (cart.length > 0 && cajaStatus.data?.is_open) {
            void submitSaleDirect();
          }
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      const isSearchInput = target === searchInputRef.current;
      const isOtherInput = !isSearchInput && (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT");

      if (isOtherInput) {
        return;
      }

      const now = Date.now();
      // 400ms threshold ensures complete barcodes are never prematurely split
      if (now - lastTime > 400) {
        buffer = "";
      }
      lastTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          const scannedCode = buffer.trim();
          buffer = "";
          handleBarcodeOrSearchSubmit(scannedCode);
          e.preventDefault();
        }
      } else if (e.key.length === 1 && !isSearchInput) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products.data, suggestions, searchQuery, activeTab, cart, cajaStatus.data?.is_open]);

  // Auto-focus search input when opening POS
  useEffect(() => {
    if (activeTab === "pos") {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  const updateQuantity = (productId: number, qty: number) => {
    const prod = products.data.find((p) => p.id === productId);
    if (!prod) return;

    if (qty <= 0) {
      setCart((current) => current.filter((item) => item.product.id !== productId));
      return;
    }

    if (qty > prod.stock) {
      alert(`Solo hay ${prod.stock} unidades en stock.`);
      return;
    }

    setCart((current) =>
      current.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const updateDiscount = (productId: number, disc: number) => {
    const valid = Math.max(0, Math.min(100, disc));
    setCart((current) =>
      current.map((item) => (item.product.id === productId ? { ...item, discount: valid } : item))
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  };

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const discount = cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity * (item.discount / 100),
      0
    );
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }, [cart]);

  const submitSaleDirect = async () => {
    if (cart.length === 0) {
      setError("El carrito debe contener al menos un producto.");
      return;
    }
    if (!cajaStatus.data?.is_open) {
      setError("Debes abrir la Caja antes de realizar ventas.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const itemsPayload = cart.map((item) => ({
        discount_rate: item.discount,
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      // Post to API
      const sale = await apiPost<Sale>("/sales/", {
        client_id: clientId ? Number(clientId) : null,
        items: itemsPayload,
        payment: Number(status) === 0 ? null : { 
          amount: cartSummary.total, 
          payment_method: Number(paymentMethod) 
        },
        status: Number(status),
      });

      setCart([]);
      setClientId("");
      onCreated(sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la venta");
    } finally {
      setSaving(false);
    }
  };

  const submitSale = async (e?: FormEvent) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    await submitSaleDirect();
  };

  return (
    <div className="stack">
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === "pos" ? "active" : ""}`}
          onClick={() => setActiveTab("pos")}
        >
          Punto de Venta (POS)
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historial de Ventas
        </button>
      </div>

      {activeTab === "pos" ? (
        <div className="pos-container">
          <div className="stack">
            <div className="panel pos-search-panel" style={{ padding: "20px" }}>
              <div className="keyboard-shortcuts-bar" style={{ marginBottom: "14px" }}>
                <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
                <span><kbd>Enter</kbd> Agregar / Escanear</span>
                <span><kbd>F4</kbd> Buscador</span>
                <span><kbd>F2</kbd> Ir a Pago</span>
                <span><kbd>Ctrl+Enter</kbd> Cobrar</span>
                <span><kbd>Esc</kbd> Limpiar</span>
              </div>
              <div className="field">
                <label style={{ fontWeight: 700, marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Buscador Inteligente de Productos (Nombre, SKU, Código de Barras o Pistola)</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-secondary)" }}>
                    Presiona <strong>Enter</strong> o escanea para agregar
                  </span>
                </label>
                <div className="pos-search-wrapper">
                  <input
                    ref={searchInputRef}
                    placeholder="Escribe el nombre del producto, SKU o escanea el código de barras completo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {suggestions.length > 0 && (
                    <div className="pos-search-suggestions">
                      {suggestions.map((p, idx) => {
                        const disabled = !p.active || p.stock === 0;
                        const isExactBarcode = p.barcode && p.barcode.trim().toLowerCase() === searchQuery.trim().toLowerCase();
                        return (
                          <div 
                            className={`pos-suggestion-item ${disabled ? "disabled" : ""} ${isExactBarcode ? "exact-match" : ""} ${idx === highlightedIndex ? "highlighted" : ""}`}
                            key={p.id}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onClick={() => !disabled && addToCart(p)}
                          >
                            <div>
                              <div className="pos-suggestion-name" style={{ fontWeight: 600 }}>{p.name}</div>
                              <div className="pos-suggestion-meta">
                                {p.barcode ? (
                                  <span className="barcode-badge" title="Código de barras completo">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>
                                    {p.barcode}
                                  </span>
                                ) : null}
                                {p.sku ? <span className="sku-badge">SKU: {p.sku}</span> : null}
                                <span className="stock-badge">Stock: {p.stock} u.</span>
                              </div>
                            </div>
                            <div className="pos-suggestion-price">{formatMoney(p.price)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="panel" style={{ padding: "20px" }}>
              <h3 style={{ marginBottom: "16px" }}>Carrito de Compra</h3>
              {cart.length === 0 ? (
                <EmptyState message="El carrito está vacío. Escanea o busca productos para agregarlos." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio</th>
                        <th>Cant.</th>
                        <th>Desc. %</th>
                        <th>Subtotal</th>
                        <th style={{ width: "60px" }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.product.id}>
                          <td style={{ fontWeight: 600 }}>
                            {item.product.name}
                            {item.product.barcode && (
                              <div style={{ fontSize: "0.75rem", fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)", marginTop: "2px" }}>
                                Cód: {item.product.barcode}
                              </div>
                            )}
                          </td>
                          <td>{formatMoney(item.product.price)}</td>
                          <td>
                            <div className="quantity-controls">
                              <button 
                                className="quantity-btn"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                type="button"
                              >
                                -
                              </button>
                              <input 
                                className="quantity-input"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    searchInputRef.current?.focus();
                                  }
                                }}
                                type="number"
                              />
                              <button 
                                className="quantity-btn"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            <input 
                              className="cart-discount-input"
                              value={item.discount}
                              min="0"
                              max="100"
                              onChange={(e) => updateDiscount(item.product.id, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  searchInputRef.current?.focus();
                                }
                              }}
                              type="number"
                            />
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {formatMoney(item.product.price * item.quantity * (1 - item.discount / 100))}
                          </td>
                          <td>
                            <button 
                              onClick={() => removeFromCart(item.product.id)}
                              style={{ color: "#ef4444", fontWeight: 700 }}
                              type="button"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <form className="form-panel" onSubmit={(e) => void submitSale(e)}>
            <h3>Resumen y Pago</h3>
            
            <Field label="Cliente [F2]">
              <select 
                ref={checkoutClientRef}
                value={clientId} 
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Consumidor Final</option>
                {clients.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="form-row">
              <Field label="Estado">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="2">Pagada</option>
                  <option value="1">Cobro Parcial</option>
                  <option value="0">Fiado / Pendiente</option>
                </select>
              </Field>
              <Field label="Metodo de pago">
                <select 
                  disabled={status === "0"} 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethods.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="stack" style={{ gap: "8px", margin: "10px 0" }}>
              <div className="sale-total" style={{ background: "transparent", padding: "4px 0", border: 0 }}>
                <span>Subtotal</span>
                <span>{formatMoney(cartSummary.subtotal)}</span>
              </div>
              <div className="sale-total" style={{ background: "transparent", padding: "4px 0", border: 0, color: "#ea580c" }}>
                <span>Descuento aplicado</span>
                <span>-{formatMoney(cartSummary.discount)}</span>
              </div>
              <div className="sale-total">
                <span>Total Final</span>
                <strong>{formatMoney(cartSummary.total)}</strong>
              </div>
            </div>

            <SubmitButton label="Registrar e Imprimir Ticket [Ctrl+Enter]" saving={saving} />
            {error ? <p className="form-error">{error}</p> : null}
            {!cajaStatus.data?.is_open && (
              <p className="form-error" style={{ color: "#d97706" }}>
                ⚠️ La caja diaria está CERRADA. Abre la caja en el menú correspondiente para vender.
              </p>
            )}
          </form>
        </div>
      ) : (
        <section className="panel">
          <DataTable
            columns={["Fecha", "Cliente", "Items", "Total", "Método", "Pagado", "Estado"]}
            rows={sales.data.map((sale) => [
              formatDate(sale.sold_at),
              sale.client?.name ?? "Consumidor final",
              sale.items.map((item) => `${item.quantity} x ${item.product.name}${item.discount_rate > 0 ? ` (-${item.discount_rate}%)` : ""}`).join(", "),
              formatMoney(sale.total_amount),
              sale.payments && sale.payments.length > 0 && sale.payments[0].payment_method != null
                ? (paymentMethods[sale.payments[0].payment_method] ?? "Efectivo")
                : (sale.status === 0 ? "Pendiente" : "Efectivo"),
              formatMoney(sale.summary.total_paid),
              saleStatuses[sale.status] ?? "Sin estado",
            ])}
          />
        </section>
      )}
    </div>
  );
}

function InventoryView({
  categories,
  onCreated,
  products,
  sales,
  stockMovements,
}: {
  categories: Loadable<Category[]>;
  onCreated: () => void;
  products: Loadable<Product[]>;
  sales: Loadable<Sale[]>;
  stockMovements: Loadable<StockMovement[]>;
}) {
  const [activeTab, setActiveTab] = useState<"catalog" | "adjust" | "history" | "new">("catalog");
  const [selectedKardexProduct, setSelectedKardexProduct] = useState<Product | null>(null);
  
  // Product Form states
  const [form, setForm] = useState({
    name: "",
    price: "",
    cost_price: "",
    stock: "",
    min_stock: "5",
    sku: "",
    barcode: "",
  });
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual stock adjustment states
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState("Entrada"); // "Entrada" o "Ajuste"
  const [adjustReason, setAdjustReason] = useState("RECUENTO");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const newProductNameRef = useRef<HTMLInputElement>(null);
  const adjustProductSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (activeTab === "new") {
      setTimeout(() => newProductNameRef.current?.focus(), 50);
    } else if (activeTab === "adjust") {
      setTimeout(() => adjustProductSelectRef.current?.focus(), 50);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedKardexProduct) {
        e.preventDefault();
        setSelectedKardexProduct(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedKardexProduct]);

  // Parse Parent and Subcategories
  const parentCategories = useMemo(() => {
    return categories.data.filter((c) => !c.name.includes(" > "));
  }, [categories.data]);

  const subCategories = useMemo(() => {
    if (!selectedParentId) return [];
    const parent = parentCategories.find((c) => c.id === Number(selectedParentId));
    if (!parent) return [];
    return categories.data.filter((c) => c.name.startsWith(parent.name + " > "));
  }, [selectedParentId, categories.data, parentCategories]);

  const submitProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const chosenCatId = selectedSubId ? Number(selectedSubId) : selectedParentId ? Number(selectedParentId) : null;
      
      const newProduct = await apiPost<Product>("/products/", {
        active: true,
        category_ids: chosenCatId ? [chosenCatId] : [],
        name: form.name,
        price: Number(form.price),
        cost_price: form.cost_price ? Number(form.cost_price) : 0,
        stock: Number(form.stock),
        min_stock: form.min_stock ? Number(form.min_stock) : 5,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
      });

      setForm({ name: "", price: "", cost_price: "", stock: "", min_stock: "5", sku: "", barcode: "" });
      setSelectedParentId("");
      setSelectedSubId("");
      setActiveTab("catalog");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el producto");
    } finally {
      setSaving(false);
    }
  };

  const submitAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustProductId) {
      setAdjustError("Selecciona un producto.");
      return;
    }
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty < 0) {
      setAdjustError("La cantidad debe ser un número mayor o igual a 0.");
      return;
    }

    setAdjusting(true);
    setAdjustError(null);

    try {
      const adjustment_type = adjustType === "Ajuste" ? "SET" : "ADD";
      const finalQty = adjustType === "Salida" ? -qty : qty;

      await apiPost(`/products/${adjustProductId}/adjust-stock`, {
        adjustment_type,
        quantity: finalQty,
        reason: adjustReason,
        notes: adjustNotes.trim() || null,
      });

      setAdjustProductId("");
      setAdjustQty("");
      setAdjustNotes("");
      setActiveTab("catalog");
      alert("Ajuste de inventario y Kardex guardados correctamente.");
      onCreated();
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Error al registrar el ajuste de stock");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="stack">
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          Catálogo de Productos
        </button>
        <button 
          className={`tab-button ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          Nuevo Producto
        </button>
        <button 
          className={`tab-button ${activeTab === "adjust" ? "active" : ""}`}
          onClick={() => setActiveTab("adjust")}
        >
          Ajustar Stock
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Auditoría de Stock (Kardex)
        </button>
      </div>

      {activeTab === "catalog" && (
        <Panel title="Inventario de Productos" state={products}>
          <DataTable
            columns={["Producto", "Categoría / Sub", "SKU", "Código de Barras", "P. Costo", "P. Venta", "Stock", "Mínimo", "Kardex", "Estado"]}
            rows={products.data.map((p) => {
              const catNames = p.categories.map((c) => c.name).join(", ");
              const displayCategory = catNames || "Sin categoría";
              const isLowStock = p.stock <= (p.min_stock ?? 5);
              return [
                p.name,
                displayCategory,
                p.sku || "-",
                p.barcode ? (
                  <span style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.5px", fontWeight: 600, whiteSpace: "nowrap" }} key={`bc-${p.id}`}>
                    {p.barcode}
                  </span>
                ) : "-",
                formatMoney(p.cost_price ?? 0),
                formatMoney(p.price),
                <span style={{ fontWeight: 700, color: isLowStock ? "#ef4444" : "inherit" }} key={p.id}>
                  {p.stock} u. {isLowStock ? "⚠️" : ""}
                </span> as any,
                `${p.min_stock ?? 5} u.`,
                <button
                  key={`kardex-${p.id}`}
                  className="secondary-button"
                  style={{ padding: "4px 8px", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                  type="button"
                  onClick={() => setSelectedKardexProduct(p)}
                >
                  📋 Kardex
                </button>,
                p.active ? "Activo" : "Inactivo",
              ];
            })}
          />
        </Panel>
      )}

      {activeTab === "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", alignItems: "start" }}>
          <form className="form-panel" onSubmit={(e) => void submitProduct(e)}>
            <h3>Agregar Nuevo Producto al Catálogo</h3>
            
            <Field label="Nombre del Producto">
              <input ref={newProductNameRef} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <div className="form-row">
              <Field label="Precio de Costo ($)">
                <input min="0" step="0.01" type="number" placeholder="Ej. 750.00" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </Field>
              <Field label="Precio de Venta ($)">
                <input min="0.01" step="0.01" type="number" required placeholder="Ej. 1200.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Stock Inicial">
                <input min="0" type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </Field>
              <Field label="Stock Mínimo Alerta">
                <input min="0" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              </Field>
            </div>

            <div className="form-row">
              <Field label="SKU / Identificador Código">
                <input placeholder="Ej. SKU-PROD123" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </Field>
              <Field label="Código de Barras (EAN / UPC)">
                <input placeholder="Ej. 7791234567890" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Categoría Principal">
                <select value={selectedParentId} onChange={(e) => { setSelectedParentId(e.target.value); setSelectedSubId(""); }}>
                  <option value="">Ninguna</option>
                  {parentCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subcategoría">
                <select 
                  disabled={!selectedParentId} 
                  value={selectedSubId} 
                  onChange={(e) => setSelectedSubId(e.target.value)}
                >
                  <option value="">Seleccionar subcategoría</option>
                  {subCategories.map((c) => {
                    const cleanSub = c.name.split(" > ")[1] || c.name;
                    return (
                      <option key={c.id} value={c.id}>
                        {cleanSub}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>

            <SubmitButton label="Crear Producto en Sistema" saving={saving} />
            {error ? <p className="form-error">{error}</p> : null}
          </form>

          <div className="panel" style={{ padding: "20px" }}>
            <h4>Ayuda de Registro</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.4" }}>
              Ingresa el código SKU y el Código de barras para posibilitar el uso de lectores rápidos de barra de pistolas POS y búsquedas inteligentes por texto parcial.
            </p>
          </div>
        </div>
      )}

      {activeTab === "adjust" && (
        <form className="form-panel" onSubmit={(e) => void submitAdjustment(e)} style={{ maxWidth: "600px" }}>
          <h3>Ajuste de Stock Manual</h3>

          <Field label="Producto a Modificar">
            <select ref={adjustProductSelectRef} value={adjustProductId} onChange={(e) => setAdjustProductId(e.target.value)}>
              <option value="">Elegir producto...</option>
              {products.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.barcode ? `[Cód: ${p.barcode}]` : ""} (Stock: {p.stock} u.)
                </option>
              ))}
            </select>
          </Field>

          <div className="form-row">
            <Field label="Tipo de Movimiento">
              <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                <option value="Entrada">Entrada (+ Sumar unidades)</option>
                <option value="Salida">Salida / Merma (- Restar unidades)</option>
                <option value="Ajuste">Recuento Físico (Sobrescribir stock total)</option>
              </select>
            </Field>
            <Field label="Motivo del Ajuste">
              <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                <option value="RECUENTO">Recuento de Inventario</option>
                <option value="ROTURA">Rotura / Daño</option>
                <option value="MERMA">Merma / Pérdida</option>
                <option value="VENCIMIENTO">Vencimiento</option>
                <option value="AJUSTE_MANUAL">Ajuste Manual / Ingreso Extra</option>
              </select>
            </Field>
          </div>

          <Field label={adjustType === "Ajuste" ? "Nuevo Stock Total Físico" : "Cantidad de Unidades"}>
            <input min="0" required type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          </Field>

          <Field label="Notas / Concepto de Auditoría">
            <input 
              placeholder="Ej. Corrección por rotura o Ingreso de prueba" 
              value={adjustNotes} 
              onChange={(e) => setAdjustNotes(e.target.value)} 
            />
          </Field>

          <SubmitButton label="Guardar Ajuste en Kardex" saving={adjusting} />
          {adjustError ? <p className="form-error">{adjustError}</p> : null}
        </form>
      )}

      {activeTab === "history" && (
        <Panel title="Registro de Entradas, Salidas y Ajustes (Kardex General)" state={stockMovements}>
          <DataTable
            columns={["Fecha", "Producto", "Movimiento", "Cant.", "Stock Previo", "Stock Resultante", "Concepto / Notas"]}
            rows={stockMovements.data.map((m) => [
              formatDate(m.created_at),
              m.product_name || `Producto #${m.product_id}`,
              m.movement_type,
              <span
                key={m.id}
                style={{
                  fontWeight: 700,
                  color: m.quantity > 0 ? "#10b981" : m.quantity < 0 ? "#ef4444" : "inherit",
                }}
              >
                {m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`} u.
              </span> as any,
              `${m.previous_stock} u.`,
              <strong>{m.current_stock} u.</strong>,
              m.notes || m.reference_type || "-",
            ])}
          />
        </Panel>
      )}

      {/* Modal Kardex por Producto Individual */}
      {selectedKardexProduct && (
        <div className="modal-backdrop" onClick={() => setSelectedKardexProduct(null)}>
          <div className="modal-content" style={{ maxWidth: "750px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Historial Kardex: {selectedKardexProduct.name}</h3>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                  SKU: <strong>{selectedKardexProduct.sku || "-"}</strong> &bull; Código de Barras: <strong style={{ fontFamily: "monospace" }}>{selectedKardexProduct.barcode || "-"}</strong> &bull; Stock Actual: <strong>{selectedKardexProduct.stock} u.</strong>
                </div>
              </div>
              <button className="close-button" onClick={() => setSelectedKardexProduct(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {(() => {
                const prodMovements = stockMovements.data.filter((m) => m.product_id === selectedKardexProduct.id);
                if (prodMovements.length === 0) {
                  return <EmptyState message="No hay movimientos registrados para este producto todavía." />;
                }
                return (
                  <DataTable
                    columns={["Fecha", "Tipo", "Cant.", "Stock Previo", "Stock Final", "Detalle"]}
                    rows={prodMovements.map((m) => [
                      formatDate(m.created_at),
                      m.movement_type,
                      <span
                        key={m.id}
                        style={{
                          fontWeight: 700,
                          color: m.quantity > 0 ? "#10b981" : m.quantity < 0 ? "#ef4444" : "inherit",
                        }}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`} u.
                      </span> as any,
                      `${m.previous_stock} u.`,
                      `${m.current_stock} u.`,
                      m.notes || m.reference_type || "-",
                    ])}
                  />
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" type="button" onClick={() => setSelectedKardexProduct(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CajaView({
  cajaStatus,
  cajaHistory,
  onRefreshCaja,
  onPrintArqueo,
}: {
  cajaStatus: Loadable<CajaStatus>;
  cajaHistory: Loadable<CajaClosing[]>;
  onRefreshCaja: () => Promise<void> | void;
  onPrintArqueo: (record: CajaClosing) => void;
}) {
  const [activeTab, setActiveTab] = useState<"daily" | "history">("daily");
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [countedCashInput, setCountedCashInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementConcept, setMovementConcept] = useState("");
  const [movementType, setMovementType] = useState<"in" | "out">("out");
  const [savingMovement, setSavingMovement] = useState(false);
  const [openingSaving, setOpeningSaving] = useState(false);
  const [closingSaving, setClosingSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openingCashRef = useRef<HTMLInputElement>(null);
  const countedCashRef = useRef<HTMLInputElement>(null);

  const statusData = cajaStatus.data;
  const expectedCash = statusData.expected_cash;
  const countedCash = countedCashInput !== "" ? Number(countedCashInput) : expectedCash;
  const difference = (Number(countedCashInput) || 0) - expectedCash;

  useEffect(() => {
    if (activeTab === "daily") {
      setTimeout(() => {
        if (!statusData.is_open) {
          openingCashRef.current?.focus();
        }
      }, 50);
    }
  }, [activeTab, statusData.is_open]);

  const openCaja = async (e: FormEvent) => {
    e.preventDefault();
    const cash = Number(openingCashInput);
    if (isNaN(cash) || cash < 0) {
      setError("Ingrese un monto inicial válido.");
      return;
    }

    setOpeningSaving(true);
    setError(null);
    try {
      await apiPost<CajaStatus>("/cash/open", { opening_cash: cash });
      setOpeningCashInput("");
      await onRefreshCaja();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir la caja");
    } finally {
      setOpeningSaving(false);
    }
  };

  const submitMovement = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(movementAmount);
    if (!amount || amount <= 0) {
      setError("El monto del movimiento debe ser mayor a 0.");
      return;
    }
    if (!movementConcept.trim()) {
      setError("Indique un concepto para el movimiento.");
      return;
    }

    setSavingMovement(true);
    setError(null);
    try {
      await apiPost("/cash/movements", {
        amount,
        concept: movementConcept.trim(),
        movement_type: movementType,
      });
      setMovementAmount("");
      setMovementConcept("");
      await onRefreshCaja();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar movimiento");
    } finally {
      setSavingMovement(false);
    }
  };

  const closeCaja = async () => {
    if (countedCashInput === "") {
      setError("Ingrese el monto de efectivo físicamente contado.");
      return;
    }

    setClosingSaving(true);
    setError(null);
    try {
      const closing = await apiPost<CajaClosing>("/cash/close", {
        counted_cash: Number(countedCashInput),
        notes: notesInput.trim() || null,
      });
      setCountedCashInput("");
      setNotesInput("");
      await onRefreshCaja();
      onPrintArqueo(closing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar la caja");
    } finally {
      setClosingSaving(false);
    }
  };

  return (
    <div className="stack">
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          Caja Chica y Arqueo Diario
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historial de Cierres
        </button>
      </div>

      {error && <div className="notice" style={{ background: "rgba(239,68,68,0.1)", borderColor: "#ef4444", color: "#c5221f" }}>{error}</div>}

      {activeTab === "daily" ? (
        !statusData.is_open ? (
          <form className="form-panel" onSubmit={(e) => void openCaja(e)} style={{ maxWidth: "440px" }}>
            <h3>Apertura de Caja Diaria</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Ingresa el monto de saldo en efectivo disponible en el cajón de dinero al iniciar el turno.
            </p>
            <Field label="Monto Inicial en Efectivo ($)">
              <input 
                ref={openingCashRef}
                required 
                type="number" 
                min="0" 
                step="0.01"
                placeholder="Ej. 5000" 
                value={openingCashInput} 
                onChange={(e) => setOpeningCashInput(e.target.value)} 
              />
            </Field>
            <SubmitButton label="Iniciar Jornada / Abrir Caja" saving={openingSaving} />
          </form>
        ) : (
          <div className="pos-container">
            <div className="stack">
              <div className="panel">
                <h3 style={{ marginBottom: "12px" }}>Estado de Caja Activa</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Iniciada el: <strong>{statusData.opened_at ? formatDate(statusData.opened_at) : "Hoy"}</strong>
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="sale-total">
                    <span>Efectivo de Apertura</span>
                    <strong>{formatMoney(statusData.opening_cash)}</strong>
                  </div>
                  <div className="sale-total" style={{ borderLeft: "4px solid var(--color-primary)" }}>
                    <span>Efectivo de Ventas</span>
                    <strong>{formatMoney(statusData.cash_sales)}</strong>
                  </div>
                  <div className="sale-total">
                    <span>Ingresos Manuales</span>
                    <strong style={{ color: "#10b981" }}>+{formatMoney(statusData.manual_in)}</strong>
                  </div>
                  <div className="sale-total">
                    <span>Egresos / Retiros</span>
                    <strong style={{ color: "#ef4444" }}>-{formatMoney(statusData.manual_out)}</strong>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3 style={{ marginBottom: "16px" }}>Desglose de Ventas del Turno</h3>
                <DataTable
                  columns={["Método de Pago", "Total"]}
                  rows={[
                    ["Efectivo en Ventas", formatMoney(statusData.cash_sales)],
                    ["Débito", formatMoney(statusData.debit_sales)],
                    ["Crédito", formatMoney(statusData.credit_sales)],
                    ["Transferencia", formatMoney(statusData.transfer_sales)],
                    ["Total General de Ventas", formatMoney(statusData.total_sales)],
                  ]}
                />
              </div>

              <form className="panel" onSubmit={(e) => void submitMovement(e)} style={{ padding: "16px" }}>
                <h4 style={{ marginBottom: "12px" }}>Movimiento Rápido de Caja</h4>
                <div className="form-row">
                  <Field label="Tipo">
                    <select value={movementType} onChange={(e) => setMovementType(e.target.value as "in" | "out")}>
                      <option value="out">Egreso / Retiro / Gasto</option>
                      <option value="in">Ingreso Extra / Aporte</option>
                    </select>
                  </Field>
                  <Field label="Monto ($)">
                    <input 
                      min="0.01" 
                      step="0.01" 
                      type="number" 
                      required 
                      placeholder="0.00" 
                      value={movementAmount} 
                      onChange={(e) => setMovementAmount(e.target.value)} 
                    />
                  </Field>
                </div>
                <Field label="Concepto / Motivo">
                  <input 
                    required 
                    placeholder="Ej. Flete de mercadería, Pago de limpieza..." 
                    value={movementConcept} 
                    onChange={(e) => setMovementConcept(e.target.value)} 
                  />
                </Field>
                <button className="secondary-button" style={{ marginTop: "8px" }} disabled={savingMovement} type="submit">
                  {savingMovement ? "Registrando..." : "Registrar Movimiento"}
                </button>
              </form>
            </div>

            <div className="form-panel">
              <h3>Arqueo y Cierre</h3>
              <Field label="Efectivo Esperado en Caja">
                <input readOnly className="readonly-input" value={formatMoney(expectedCash)} />
              </Field>
              <Field label="Efectivo Contado (Físicamente)">
                <input 
                  ref={countedCashRef}
                  required 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="Ingrese el conteo real..." 
                  value={countedCashInput} 
                  onChange={(e) => setCountedCashInput(e.target.value)}
                />
              </Field>

              <Field label="Observaciones / Notas de Cierre">
                <input 
                  placeholder="Notas adicionales..." 
                  value={notesInput} 
                  onChange={(e) => setNotesInput(e.target.value)} 
                />
              </Field>

              <div className="sale-total" style={{ margin: "6px 0" }}>
                <span>Diferencia</span>
                <strong style={{ color: difference === 0 ? "var(--text-primary)" : difference > 0 ? "#10b981" : "#ef4444" }}>
                  {formatMoney(difference)}
                </strong>
              </div>

              {difference !== 0 && countedCashInput !== "" && (
                <div 
                  className="notice" 
                  style={{ 
                    background: difference > 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    borderColor: difference > 0 ? "#10b981" : "#ef4444",
                    color: difference > 0 ? "#137333" : "#c5221f"
                  }}
                >
                  {difference > 0 ? `💰 Sobrante detectado de ${formatMoney(difference)}` : `⚠️ Faltante detectado de ${formatMoney(Math.abs(difference))}`}
                </div>
              )}

              <button 
                className="primary-button" 
                onClick={() => void closeCaja()} 
                disabled={closingSaving} 
                type="button"
              >
                {closingSaving ? "Cerrando Caja..." : "Registrar Cierre e Imprimir Arqueo"}
              </button>
            </div>
          </div>
        )
      ) : (
        <Panel title="Historial de Arqueos Registrados">
          <DataTable
            columns={["Fecha Cierre", "Apertura", "Ventas Efec.", "Esperado", "Contado", "Diferencia", "Notas", "Acciones"]}
            rows={cajaHistory.data.map((h) => {
              const diff = h.difference ?? 0;
              return [
                formatDate(h.closed_at || h.opened_at),
                formatMoney(h.opening_cash),
                formatMoney(h.cash_sales),
                formatMoney(h.expected_cash),
                formatMoney(h.counted_cash ?? 0),
                diff === 0 ? "Cuadrada" : diff > 0 ? `Sobrante (+${formatMoney(diff)})` : `Faltante (-${formatMoney(Math.abs(diff))})`,
                h.notes || "-",
                <button 
                  onClick={() => onPrintArqueo(h)}
                  style={{ color: "var(--color-primary)", fontWeight: 700 }}
                  type="button"
                  key={h.id}
                >
                  Imprimir
                </button> as any
              ];
            })}
          />
        </Panel>
      )}
    </div>
  );
}

function ClientsView({
  clients,
  onCreated,
  onPaymentRegistered,
  cajaStatus,
}: {
  clients: Loadable<Client[]>;
  onCreated: () => void;
  onPaymentRegistered: (receipt: {
    clientName: string;
    clientDni?: string | null;
    amount: number;
    paymentMethod: number;
    remainingDebt: number;
    saleId?: number | null;
    date: string;
  }) => void;
  cajaStatus: Loadable<CajaStatus>;
}) {
  const [activeTab, setActiveTab] = useState<"directory" | "new">("directory");
  const [search, setSearch] = useState("");
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  // New client form state
  const [form, setForm] = useState({ dni: "", name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment / Debt collection modal state
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<Client | null>(null);
  const [clientAccount, setClientAccount] = useState<ClientAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("0");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // View account statement modal state
  const [viewingAccountClient, setViewingAccountClient] = useState<Client | null>(null);

  const newClientNameRef = useRef<HTMLInputElement>(null);
  const paymentAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "new") {
      setTimeout(() => newClientNameRef.current?.focus(), 50);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedClientForPayment) {
      setTimeout(() => paymentAmountRef.current?.focus(), 50);
    }
  }, [selectedClientForPayment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedClientForPayment) {
          e.preventDefault();
          setSelectedClientForPayment(null);
        } else if (viewingAccountClient) {
          e.preventDefault();
          setViewingAccountClient(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClientForPayment, viewingAccountClient]);

  // Metrics
  const totalDebts = useMemo(() => {
    return clients.data.reduce((sum, c) => sum + (c.total_debt ?? 0), 0);
  }, [clients.data]);

  const debtorCount = useMemo(() => {
    return clients.data.filter((c) => (c.total_debt ?? 0) > 0.009).length;
  }, [clients.data]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.data.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.dni && c.dni.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q));
      const matchDebtor = !onlyDebtors || (c.total_debt ?? 0) > 0.009;
      return matchSearch && matchDebtor;
    });
  }, [clients.data, search, onlyDebtors]);

  const submitNewClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost<Client>("/clients/", {
        active: true,
        dni: form.dni || null,
        name: form.name,
        phone: form.phone || null,
      });
      setForm({ dni: "", name: "", phone: "" });
      setActiveTab("directory");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = async (client: Client) => {
    setSelectedClientForPayment(client);
    setPaymentAmount(String(client.total_debt ?? 0));
    setPaymentMethod("0");
    setSelectedSaleId(null);
    setPaymentError(null);
    setLoadingAccount(true);

    try {
      const acc = await apiGet<ClientAccount>(`/clients/${client.id}/account`);
      setClientAccount(acc);
      setPaymentAmount(String(acc.total_debt));
    } catch {
      // fallback
    } finally {
      setLoadingAccount(false);
    }
  };

  const openAccountStatement = async (client: Client) => {
    setViewingAccountClient(client);
    setLoadingAccount(true);
    try {
      const acc = await apiGet<ClientAccount>(`/clients/${client.id}/account`);
      setClientAccount(acc);
    } catch {
      // fallback
    } finally {
      setLoadingAccount(false);
    }
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClientForPayment) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("El monto debe ser numérico y mayor a 0.");
      return;
    }

    setSavingPayment(true);
    setPaymentError(null);
    try {
      const updatedAccount = await apiPost<ClientAccount>(`/clients/${selectedClientForPayment.id}/payments`, {
        amount,
        payment_method: Number(paymentMethod),
        sale_id: selectedSaleId,
      });

      const clientName = selectedClientForPayment.name;
      const clientDni = selectedClientForPayment.dni;
      const remainingDebt = updatedAccount.total_debt;
      const payMethodNum = Number(paymentMethod);
      const targetSale = selectedSaleId;

      setSelectedClientForPayment(null);
      setClientAccount(null);

      onPaymentRegistered({
        clientName,
        clientDni,
        amount,
        paymentMethod: payMethodNum,
        remainingDebt,
        saleId: targetSale,
        date: new Date().toISOString(),
      });
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Error al registrar el cobro");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="stack">
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === "directory" ? "active" : ""}`}
          onClick={() => setActiveTab("directory")}
        >
          Directorio y Cuentas Corrientes
        </button>
        <button 
          className={`tab-button ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          Nuevo Cliente
        </button>
      </div>

      <section className="metric-grid">
        <MetricCard 
          label="Total Deudas por Cobrar" 
          value={formatMoney(totalDebts)} 
          meta={`${debtorCount} clientes con saldo deudor`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12" y2="18"></line>
              <path d="M17 12h-5v2h5v-2z"></path>
            </svg>
          }
        />
        <MetricCard 
          label="Clientes con Deuda" 
          value={debtorCount.toString()} 
          meta="Cuentas activas fiadas"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <polyline points="17 11 19 13 23 9"></polyline>
            </svg>
          }
        />
        <MetricCard 
          label="Total Clientes" 
          value={clients.data.length.toString()} 
          meta="Cartera de clientes"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          }
        />
      </section>

      {activeTab === "directory" ? (
        <div className="stack">
          <div className="panel" style={{ padding: "16px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "240px" }}>
              <input 
                placeholder="Buscar por nombre, DNI o teléfono..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
              <input 
                type="checkbox" 
                checked={onlyDebtors} 
                onChange={(e) => setOnlyDebtors(e.target.checked)} 
              />
              Solo con saldo deudor (fiados)
            </label>
          </div>

          <Panel title="Cartera de Clientes" state={clients}>
            <DataTable
              columns={["Nombre", "DNI", "Teléfono", "Saldo Deudor (Cta Cte)", "Estado", "Acciones"]}
              rows={filteredClients.map((client) => {
                const debt = client.total_debt ?? 0;
                return [
                  client.name,
                  client.dni ?? "-",
                  client.phone ?? "-",
                  <span style={{ fontWeight: 700, color: debt > 0.009 ? "#ef4444" : "inherit" }}>
                    {formatMoney(debt)} {debt > 0.009 ? "⚠️" : ""}
                  </span> as any,
                  client.active ? "Activo" : "Inactivo",
                  <div style={{ display: "flex", gap: "6px" }} key={client.id}>
                    {debt > 0.009 && (
                      <button
                        className="primary-button"
                        style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                        onClick={() => void openPaymentModal(client)}
                        type="button"
                      >
                        Cobrar Deuda
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                      onClick={() => void openAccountStatement(client)}
                      type="button"
                    >
                      Ver Cuenta
                    </button>
                  </div> as any,
                ];
              })}
            />
          </Panel>
        </div>
      ) : (
        <form className="form-panel" onSubmit={(event) => void submitNewClient(event)} style={{ maxWidth: "500px" }}>
          <h3>Nuevo cliente</h3>
          <Field label="Nombre">
            <input ref={newClientNameRef} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="DNI">
            <input value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
          </Field>
          <Field label="Telefono">
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <SubmitButton label="Crear cliente" saving={saving} />
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      )}

      {/* Cobrar Deuda Modal */}
      {selectedClientForPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedClientForPayment(null)}>
          <div className="modal-content" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cobranza de Cuenta Corriente</h3>
              <button className="close-button" onClick={() => setSelectedClientForPayment(null)}>&times;</button>
            </div>
            <form onSubmit={(e) => void submitPayment(e)}>
              <div className="modal-body">
                <div style={{ background: "rgba(239,68,68,0.08)", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Cliente: <strong>{selectedClientForPayment.name}</strong></div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#c5221f", marginTop: "4px" }}>
                    Deuda Total: {formatMoney(clientAccount?.total_debt ?? (selectedClientForPayment.total_debt ?? 0))}
                  </div>
                </div>

                {loadingAccount ? (
                  <p>Cargando detalle de cuenta corriente...</p>
                ) : clientAccount && clientAccount.pending_sales.length > 0 ? (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                      Ventas con Saldo Pendiente:
                    </label>
                    <div className="table-wrap" style={{ maxHeight: "160px", overflowY: "auto" }}>
                      <table style={{ fontSize: "0.85rem" }}>
                        <thead>
                          <tr>
                            <th>Venta</th>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Saldo</th>
                            <th>Aplicar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientAccount.pending_sales.map((sale) => (
                            <tr key={sale.sale_id} style={{ background: selectedSaleId === sale.sale_id ? "rgba(37,99,235,0.08)" : undefined }}>
                              <td>#{sale.sale_id}</td>
                              <td>{formatDate(sale.sold_at)}</td>
                              <td>{formatMoney(sale.total_amount)}</td>
                              <td style={{ fontWeight: 700, color: "#ef4444" }}>{formatMoney(sale.balance)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                  onClick={() => {
                                    if (selectedSaleId === sale.sale_id) {
                                      setSelectedSaleId(null);
                                      setPaymentAmount(String(clientAccount.total_debt));
                                    } else {
                                      setSelectedSaleId(sale.sale_id);
                                      setPaymentAmount(String(sale.balance));
                                    }
                                  }}
                                >
                                  {selectedSaleId === sale.sale_id ? "Deseleccionar" : "Pagar esta"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                      {selectedSaleId ? `Cobrando específicamente venta #${selectedSaleId}` : "El cobro se distribuirá automáticamente en las ventas más antiguas (FIFO)."}
                    </div>
                  </div>
                ) : null}

                <div className="form-row">
                  <Field label="Monto a Cobrar ($)">
                    <input 
                      ref={paymentAmountRef}
                      type="number" 
                      min="0.01" 
                      step="0.01" 
                      required 
                      value={paymentAmount} 
                      onChange={(e) => setPaymentAmount(e.target.value)} 
                    />
                  </Field>
                  <Field label="Método de Pago">
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {paymentMethods.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {!cajaStatus.data.is_open && paymentMethod === "0" && (
                  <p className="form-error" style={{ color: "#d97706" }}>
                    ⚠️ La caja diaria está cerrada. Si cobras en efectivo, se registrará el pago pero no impactará en un turno abierto.
                  </p>
                )}

                {paymentError && <p className="form-error">{paymentError}</p>}
              </div>

              <div className="modal-footer">
                <button className="primary-button" disabled={savingPayment} type="submit">
                  {savingPayment ? "Procesando Cobro..." : "Confirmar Cobro e Imprimir Recibo"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setSelectedClientForPayment(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ver Cuenta Corriente Modal */}
      {viewingAccountClient && (
        <div className="modal-backdrop" onClick={() => setViewingAccountClient(null)}>
          <div className="modal-content" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Estado de Cuenta - {viewingAccountClient.name}</h3>
              <button className="close-button" onClick={() => setViewingAccountClient(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div>DNI: {viewingAccountClient.dni || "Sin registrar"}</div>
                  <div>Teléfono: {viewingAccountClient.phone || "Sin registrar"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Saldo Deudor Total:</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: (clientAccount?.total_debt ?? 0) > 0 ? "#ef4444" : "#10b981" }}>
                    {formatMoney(clientAccount?.total_debt ?? 0)}
                  </div>
                </div>
              </div>

              <h4 style={{ marginBottom: "8px" }}>Ventas Pendientes de Pago</h4>
              {clientAccount?.pending_sales.length === 0 ? (
                <EmptyState message="El cliente no tiene ventas adeudadas." />
              ) : (
                <div className="table-wrap" style={{ marginBottom: "16px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Venta</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Pagado</th>
                        <th>Saldo Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAccount?.pending_sales.map((s) => (
                        <tr key={s.sale_id}>
                          <td>#{s.sale_id}</td>
                          <td>{formatDate(s.sold_at)}</td>
                          <td>{formatMoney(s.total_amount)}</td>
                          <td>{formatMoney(s.total_paid)}</td>
                          <td style={{ fontWeight: 700, color: "#ef4444" }}>{formatMoney(s.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 style={{ marginBottom: "8px" }}>Historial de Pagos Realizados</h4>
              {clientAccount?.recent_payments.length === 0 ? (
                <EmptyState message="No se han registrado pagos aún." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Venta Asociada</th>
                        <th>Método</th>
                        <th>Monto Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAccount?.recent_payments.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.paid_at)}</td>
                          <td>#{p.sale_id}</td>
                          <td>{paymentMethods[p.payment_method] ?? "Efectivo"}</td>
                          <td style={{ fontWeight: 700, color: "#10b981" }}>+{formatMoney(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setViewingAccountClient(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuppliersView({
  onCreated,
  products,
  suppliers,
  purchases,
  cajaStatus,
}: {
  onCreated: () => void;
  products: Loadable<Product[]>;
  suppliers: Loadable<Supplier[]>;
  purchases: Loadable<Purchase[]>;
  cajaStatus: Loadable<CajaStatus>;
}) {
  const [activeTab, setActiveTab] = useState<"catalog" | "new_purchase" | "history" | "new_supplier">("catalog");

  // New supplier form state
  const [form, setForm] = useState({ address: "", email: "", name: "", phone: "", productId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Purchase form state
  type PurchaseDraftItem = {
    product: Product;
    quantity: number;
    unit_cost: number;
  };
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState("2"); // 2 = Pagada, 0 = A pagar (Cta Cte), 1 = Parcial
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("0");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseDraftItem[]>([]);
  const [selectedProdId, setSelectedProdId] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemCost, setItemCost] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Pay purchase modal state
  const [payingPurchase, setPayingPurchase] = useState<Purchase | null>(null);
  const [payPurchaseAmount, setPayPurchaseAmount] = useState("");
  const [payPurchaseMethod, setPayPurchaseMethod] = useState("0");
  const [savingPayPurchase, setSavingPayPurchase] = useState(false);
  const [payPurchaseError, setPayPurchaseError] = useState<string | null>(null);

  const purchaseSupplierSelectRef = useRef<HTMLSelectElement>(null);
  const newSupplierNameRef = useRef<HTMLInputElement>(null);
  const payPurchaseAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "new_purchase") {
      setTimeout(() => purchaseSupplierSelectRef.current?.focus(), 50);
    } else if (activeTab === "new_supplier") {
      setTimeout(() => newSupplierNameRef.current?.focus(), 50);
    }
  }, [activeTab]);

  useEffect(() => {
    if (payingPurchase) {
      setTimeout(() => payPurchaseAmountRef.current?.focus(), 50);
    }
  }, [payingPurchase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && payingPurchase) {
        e.preventDefault();
        setPayingPurchase(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [payingPurchase]);

  // Metrics
  const totalSupplierDebt = useMemo(() => {
    return purchases.data.reduce((sum, p) => sum + (p.summary.balance ?? 0), 0);
  }, [purchases.data]);

  // Total of current draft purchase
  const purchaseTotal = useMemo(() => {
    return purchaseItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  }, [purchaseItems]);

  const addDraftItem = () => {
    if (!selectedProdId) return;
    const prod = products.data.find((p) => p.id === Number(selectedProdId));
    if (!prod) return;
    const qty = Number(itemQty);
    const cost = Number(itemCost);
    if (qty <= 0 || isNaN(qty)) {
      alert("Ingrese una cantidad válida");
      return;
    }
    if (cost < 0 || isNaN(cost)) {
      alert("Ingrese un precio de costo válido");
      return;
    }

    setPurchaseItems((current) => {
      const existing = current.find((i) => i.product.id === prod.id);
      if (existing) {
        return current.map((i) =>
          i.product.id === prod.id ? { ...i, quantity: i.quantity + qty, unit_cost: cost } : i
        );
      }
      return [...current, { product: prod, quantity: qty, unit_cost: cost }];
    });

    setSelectedProdId("");
    setItemQty("1");
    setItemCost("");
  };

  const removeDraftItem = (prodId: number) => {
    setPurchaseItems((current) => current.filter((i) => i.product.id !== prodId));
  };

  const submitPurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!purchaseSupplierId) {
      setPurchaseError("Selecciona un proveedor.");
      return;
    }
    if (purchaseItems.length === 0) {
      setPurchaseError("Agrega al menos un producto a la compra.");
      return;
    }

    setSavingPurchase(true);
    setPurchaseError(null);
    try {
      const itemsPayload = purchaseItems.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      }));

      await apiPost<Purchase>("/purchases/", {
        supplier_id: Number(purchaseSupplierId),
        invoice_number: purchaseInvoiceNumber || null,
        status: Number(purchaseStatus),
        notes: purchaseNotes || null,
        items: itemsPayload,
        payment:
          Number(purchaseStatus) === 0
            ? null
            : {
                amount: purchaseTotal,
                payment_method: Number(purchasePaymentMethod),
              },
      });

      setPurchaseItems([]);
      setPurchaseSupplierId("");
      setPurchaseInvoiceNumber("");
      setPurchaseNotes("");
      setActiveTab("history");
      onCreated();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Error al registrar la compra");
    } finally {
      setSavingPurchase(false);
    }
  };

  const openPayPurchaseModal = (p: Purchase) => {
    setPayingPurchase(p);
    setPayPurchaseAmount(String(p.summary.balance));
    setPayPurchaseMethod("0");
    setPayPurchaseError(null);
  };

  const submitPayPurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!payingPurchase) return;
    const amount = Number(payPurchaseAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayPurchaseError("El monto debe ser numérico y mayor a 0.");
      return;
    }

    setSavingPayPurchase(true);
    setPayPurchaseError(null);
    try {
      await apiPost<Purchase>(`/purchases/${payingPurchase.id}/payments`, {
        amount,
        payment_method: Number(payPurchaseMethod),
      });
      setPayingPurchase(null);
      onCreated();
    } catch (err) {
      setPayPurchaseError(err instanceof Error ? err.message : "Error al registrar el pago a la factura");
    } finally {
      setSavingPayPurchase(false);
    }
  };

  const submitNewSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost<Supplier>("/suppliers/", {
        address: form.address || null,
        email: form.email || null,
        name: form.name,
        phone: form.phone || null,
        product_ids: form.productId ? [Number(form.productId)] : [],
      });
      setForm({ address: "", email: "", name: "", phone: "", productId: "" });
      setActiveTab("catalog");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el proveedor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          Directorio de Proveedores
        </button>
        <button 
          className={`tab-button ${activeTab === "new_purchase" ? "active" : ""}`}
          onClick={() => setActiveTab("new_purchase")}
        >
          Nueva Compra / Ingreso de Stock
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historial de Compras y Deudas
        </button>
        <button 
          className={`tab-button ${activeTab === "new_supplier" ? "active" : ""}`}
          onClick={() => setActiveTab("new_supplier")}
        >
          Nuevo Proveedor
        </button>
      </div>

      <section className="metric-grid">
        <MetricCard 
          label="Deuda a Proveedores por Pagar" 
          value={formatMoney(totalSupplierDebt)} 
          meta="Cuentas por pagar pendientes"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          }
        />
        <MetricCard 
          label="Facturas de Compra" 
          value={purchases.data.length.toString()} 
          meta="Compras registradas"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12" y2="18"></line>
            </svg>
          }
        />
        <MetricCard 
          label="Proveedores Activos" 
          value={suppliers.data.length.toString()} 
          meta="Contactos comerciales"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          }
        />
      </section>

      {activeTab === "catalog" && (
        <Panel title="Directorio de Proveedores" state={suppliers}>
          <DataTable
            columns={["Nombre", "Teléfono", "Email", "Dirección", "Productos Asociados", "Saldo por Pagar"]}
            rows={suppliers.data.map((supplier) => {
              const supplierDebt = purchases.data
                .filter((p) => p.supplier.id === supplier.id)
                .reduce((sum, p) => sum + p.summary.balance, 0);
              return [
                supplier.name,
                supplier.phone ?? "-",
                supplier.email ?? "-",
                supplier.address ?? "-",
                supplier.products.map((product) => product.name).join(", ") || "-",
                <span style={{ fontWeight: 700, color: supplierDebt > 0 ? "#ef4444" : "inherit" }} key={supplier.id}>
                  {formatMoney(supplierDebt)}
                </span> as any,
              ];
            })}
          />
        </Panel>
      )}

      {activeTab === "new_purchase" && (
        <form className="form-panel" onSubmit={(e) => void submitPurchase(e)} style={{ maxWidth: "800px" }}>
          <h3>Registrar Nueva Compra / Entrada de Mercadería</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
            El stock de los productos ingresados aumentará automáticamente al confirmar la compra.
          </p>

          <div className="form-row">
            <Field label="Proveedor">
              <select 
                ref={purchaseSupplierSelectRef} 
                required 
                value={purchaseSupplierId} 
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.data.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Nro. Factura / Remito">
              <input placeholder="Ej. FC-0001-12345" value={purchaseInvoiceNumber} onChange={(e) => setPurchaseInvoiceNumber(e.target.value)} />
            </Field>
          </div>

          <div className="panel" style={{ padding: "16px", margin: "16px 0", background: "var(--color-surface)" }}>
            <h4 style={{ marginBottom: "12px" }}>Agregar Productos al Pedido</h4>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
              <Field label="Producto">
                <select 
                  value={selectedProdId} 
                  onChange={(e) => {
                    setSelectedProdId(e.target.value);
                    const prod = products.data.find((p) => p.id === Number(e.target.value));
                    if (prod) setItemCost(String(prod.cost_price || ""));
                  }}
                >
                  <option value="">Elegir producto...</option>
                  {products.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `[Cód: ${p.barcode}]` : ""} (Stock: {p.stock} u.)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad">
                <input 
                  type="number" 
                  min="1" 
                  value={itemQty} 
                  onChange={(e) => setItemQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDraftItem();
                    }
                  }} 
                />
              </Field>
              <Field label="Costo Unitario ($)">
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={itemCost} 
                  onChange={(e) => setItemCost(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDraftItem();
                    }
                  }} 
                />
              </Field>
              <button className="secondary-button" style={{ height: "40px", marginBottom: "8px" }} type="button" onClick={addDraftItem}>
                + Agregar
              </button>
            </div>

            {purchaseItems.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: "12px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Costo Unit.</th>
                      <th>Subtotal</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.map((item) => (
                      <tr key={item.product.id}>
                        <td>{item.product.name}</td>
                        <td>+{item.quantity} u.</td>
                        <td>{formatMoney(item.unit_cost)}</td>
                        <td style={{ fontWeight: 700 }}>{formatMoney(item.quantity * item.unit_cost)}</td>
                        <td>
                          <button 
                            type="button" 
                            style={{ color: "#ef4444", fontWeight: 700 }}
                            onClick={() => removeDraftItem(item.product.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                No hay productos en el pedido. Selecciona un producto para agregarlo.
              </p>
            )}
          </div>

          <div className="form-row">
            <Field label="Condición de Pago">
              <select value={purchaseStatus} onChange={(e) => setPurchaseStatus(e.target.value)}>
                <option value="2">Pagada al Contado</option>
                <option value="0">A Pagar (Cuenta Corriente / Fiado)</option>
              </select>
            </Field>
            <Field label="Método de Pago">
              <select 
                disabled={purchaseStatus === "0"} 
                value={purchasePaymentMethod} 
                onChange={(e) => setPurchasePaymentMethod(e.target.value)}
              >
                {paymentMethods.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Observaciones / Notas">
            <input placeholder="Detalles de la compra..." value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} />
          </Field>

          <div className="sale-total" style={{ margin: "16px 0" }}>
            <span>Total de la Compra</span>
            <strong>{formatMoney(purchaseTotal)}</strong>
          </div>

          {purchaseStatus === "2" && purchasePaymentMethod === "0" && (
            <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", marginBottom: "12px" }}>
              ℹ️ Al pagar en efectivo, el egreso se registrará automáticamente en la Caja diaria activa.
            </p>
          )}

          <SubmitButton label="Confirmar Compra e Ingresar Stock" saving={savingPurchase} />
          {purchaseError && <p className="form-error">{purchaseError}</p>}
        </form>
      )}

      {activeTab === "history" && (
        <Panel title="Historial de Compras a Proveedores" state={purchases}>
          <DataTable
            columns={["Fecha", "Factura/Remito", "Proveedor", "Total", "Pagado", "Saldo Adeudado", "Estado", "Acción"]}
            rows={purchases.data.map((p) => {
              const bal = p.summary.balance;
              return [
                formatDate(p.purchased_at),
                p.invoice_number || "-",
                p.supplier.name,
                formatMoney(p.total_amount),
                formatMoney(p.summary.total_paid),
                <span style={{ fontWeight: 700, color: bal > 0 ? "#ef4444" : "inherit" }}>
                  {formatMoney(bal)}
                </span> as any,
                purchaseStatuses[p.status] ?? "Sin estado",
                bal > 0 ? (
                  <button
                    className="primary-button"
                    style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                    onClick={() => openPayPurchaseModal(p)}
                    type="button"
                    key={p.id}
                  >
                    Pagar Saldo
                  </button>
                ) : (
                  <span style={{ color: "#10b981", fontWeight: 700 }}>Saldada</span>
                ) as any,
              ];
            })}
          />
        </Panel>
      )}

      {activeTab === "new_supplier" && (
        <form className="form-panel" onSubmit={(event) => void submitNewSupplier(event)} style={{ maxWidth: "500px" }}>
          <h3>Nuevo proveedor</h3>
          <Field label="Nombre">
            <input ref={newSupplierNameRef} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Telefono">
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Direccion">
            <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <Field label="Producto asociado">
            <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
              <option value="">Sin producto</option>
              {products.data.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton label="Crear proveedor" saving={saving} />
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      )}

      {/* Pagar Saldo a Proveedor Modal */}
      {payingPurchase && (
        <div className="modal-backdrop" onClick={() => setPayingPurchase(null)}>
          <div className="modal-content" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Pagar Factura a Proveedor</h3>
              <button className="close-button" onClick={() => setPayingPurchase(null)}>&times;</button>
            </div>
            <form onSubmit={(e) => void submitPayPurchase(e)}>
              <div className="modal-body">
                <div style={{ background: "rgba(239,68,68,0.08)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div>Proveedor: <strong>{payingPurchase.supplier.name}</strong></div>
                  <div>Factura: <strong>{payingPurchase.invoice_number || `#${payingPurchase.id}`}</strong></div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#c5221f", marginTop: "4px" }}>
                    Saldo Pendiente: {formatMoney(payingPurchase.summary.balance)}
                  </div>
                </div>

                <Field label="Monto a Pagar ($)">
                  <input 
                    ref={payPurchaseAmountRef}
                    type="number" 
                    min="0.01" 
                    step="0.01" 
                    required 
                    value={payPurchaseAmount} 
                    onChange={(e) => setPayPurchaseAmount(e.target.value)} 
                  />
                </Field>

                <Field label="Método de Pago">
                  <select value={payPurchaseMethod} onChange={(e) => setPayPurchaseMethod(e.target.value)}>
                    {paymentMethods.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                </Field>

                {payPurchaseMethod === "0" && (
                  <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", marginTop: "6px" }}>
                    ℹ️ El pago en efectivo se descontará de la Caja diaria activa.
                  </p>
                )}

                {payPurchaseError && <p className="form-error">{payPurchaseError}</p>}
              </div>

              <div className="modal-footer">
                <button className="primary-button" disabled={savingPayPurchase} type="submit">
                  {savingPayPurchase ? "Registrando Pago..." : "Confirmar Pago a Proveedor"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setPayingPurchase(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesView({ categories, onCreated }: { categories: Loadable<Category[]>; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Parent categories (no " > " in name)
  const parentCategories = useMemo(() => {
    return categories.data.filter((c) => !c.name.includes(" > "));
  }, [categories.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let finalName = name;
      if (parentId) {
        const parent = parentCategories.find((c) => c.id === Number(parentId));
        if (parent) {
          finalName = `${parent.name} > ${name}`;
        }
      }
      await apiPost<Category>("/categories/", { name: finalName });
      setName("");
      setParentId("");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la categoria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="work-grid">
      <Panel title="Categorias" state={categories}>
        <DataTable 
          columns={["ID", "Nombre / Jerarquía"]} 
          rows={categories.data.map((category) => [
            category.id.toString(), 
            category.name
          ])} 
        />
      </Panel>

      <form className="form-panel" onSubmit={(event) => void submit(event)}>
        <h3>Nueva categoria</h3>
        <Field label="Nombre de Categoría">
          <input ref={nameInputRef} required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Categoría Padre (Opcional)">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Ninguna (Sería categoría principal)</option>
            {parentCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <SubmitButton label="Crear categoria" saving={saving} />
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </section>
  );
}

function AjustesView({
  theme,
  setTheme,
  systemThemeSync,
  setSystemThemeSync,
  accentColor,
  setAccentColor,
  daltonism,
  setSystemThemeSync: _skip1, // suppress React warning if passed accidentally
  setDaltonism,
  highContrast,
  setHighContrast,
  textScale,
  setTextScale,
}: {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  systemThemeSync: boolean;
  setSystemThemeSync: (s: boolean) => void;
  accentColor: string;
  setAccentColor: (a: string) => void;
  daltonism: string;
  setDaltonism: (d: string) => void;
  highContrast: boolean;
  setHighContrast: (h: boolean) => void;
  textScale: string;
  setTextScale: (s: string) => void;
  [key: string]: any;
}) {
  return (
    <div className="pos-container">
      <div className="stack">
        <div className="panel">
          <h3 style={{ marginBottom: "20px" }}>Visualización y Accesibilidad</h3>
          
          <div className="settings-group">
            <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Tema Visual</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                className={`secondary-button ${theme === "light" && !systemThemeSync ? "active" : ""}`}
                style={{ borderColor: theme === "light" && !systemThemeSync ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => { setSystemThemeSync(false); setTheme("light"); }}
                type="button"
              >
                Claro
              </button>
              <button 
                className={`secondary-button ${theme === "dark" && !systemThemeSync ? "active" : ""}`}
                style={{ borderColor: theme === "dark" && !systemThemeSync ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => { setSystemThemeSync(false); setTheme("dark"); }}
                type="button"
              >
                Oscuro
              </button>
              <button 
                className={`secondary-button ${systemThemeSync ? "active" : ""}`}
                style={{ borderColor: systemThemeSync ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => setSystemThemeSync(true)}
                type="button"
              >
                Sincronizar con Sistema
              </button>
            </div>
          </div>

          <div className="settings-group" style={{ marginTop: "24px" }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Color de Acento (Identidad)</label>
            <select value={accentColor} onChange={(e) => setAccentColor(e.target.value)}>
              <option value="gestock-blue">Azul GESTOCK (Original)</option>
              <option value="emerald-green">Verde Esmeralda</option>
              <option value="purple">Púrpura Vibrante</option>
              <option value="orange">Naranja Intenso</option>
            </select>
          </div>

          <div className="settings-group" style={{ marginTop: "24px" }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Filtro de Contraste para Daltonismo</label>
            <select value={daltonism} onChange={(e) => setDaltonism(e.target.value)}>
              <option value="none">Sin corrección (Por defecto)</option>
              <option value="deutan">Deuteranopía (Verde/Rojo suave)</option>
              <option value="protan">Protanopía (Rojo/Verde suave)</option>
              <option value="tritan">Tritanopía (Azul/Amarillo suave)</option>
            </select>
          </div>

          <div className="settings-group" style={{ marginTop: "24px", display: "flex", gap: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 700, cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={highContrast} 
                onChange={(e) => setHighContrast(e.target.checked)} 
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              Modo Alto Contraste (Realzar Bordes y Legibilidad)
            </label>
          </div>

          <div className="settings-group" style={{ marginTop: "24px" }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Escala del Texto General</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                className="secondary-button"
                style={{ borderColor: textScale === "small" ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => setTextScale("small")}
                type="button"
              >
                Pequeño
              </button>
              <button 
                className="secondary-button"
                style={{ borderColor: textScale === "normal" ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => setTextScale("normal")}
                type="button"
              >
                Normal
              </button>
              <button 
                className="secondary-button"
                style={{ borderColor: textScale === "large" ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => setTextScale("large")}
                type="button"
              >
                Grande
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: "20px" }}>
        <h4>Información de Accesibilidad</h4>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.4" }}>
          La configuración de GESTOCK cumple con las pautas de accesibilidad para herramientas operativas comerciales. El modo de alto contraste y los preajustes de daltonismo están orientados a mejorar la lectura en pantallas táctiles y entornos con luz variable.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, meta, value, icon }: { label: string; meta: string; value: string; icon?: React.ReactNode }) {
  return (
    <article className="metric-card">
      <div className="metric-header">
        <span>{label}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <strong>{value}</strong>
      <p>{meta}</p>
    </article>
  );
}

function Panel<T>({ children, state, title }: { children: React.ReactNode; state?: Loadable<T>; title: string }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {state?.loading ? <span className="loading-pill">Cargando</span> : null}
      </div>
      {state?.error ? <EmptyState message={`No se pudo cargar: ${state.error}`} /> : children}
    </section>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | React.ReactNode)[][] }) {
  if (rows.length === 0) {
    return <EmptyState message="Todavia no hay datos para mostrar." />;
  }

  const renderCell = (cell: string | React.ReactNode) => {
    if (typeof cell !== "string") {
      return cell;
    }
    const trimmed = cell.trim();
    if (trimmed === "Pagada" || trimmed === "Activo" || trimmed === "Cuadrada") {
      return <span className="badge badge-success">{trimmed}</span>;
    }
    if (trimmed === "Pendiente" || trimmed === "Parcial") {
      return <span className="badge badge-warning">{trimmed}</span>;
    }
    if (trimmed === "Inactivo" || trimmed.startsWith("Faltante")) {
      return <span className="badge badge-danger">{trimmed}</span>;
    }
    if (trimmed.startsWith("Sobrante")) {
      return <span className="badge badge-success" style={{ background: "var(--badge-success-bg)", color: "var(--badge-success-text)" }}>{trimmed}</span>;
    }
    if (trimmed === "Sin categoria" || trimmed === "-") {
      return <span className="badge badge-neutral">{trimmed}</span>;
    }
    return cell;
  };

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{renderCell(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SubmitButton({ label, saving }: { label: string; saving: boolean }) {
  return (
    <button className="primary-button" disabled={saving} type="submit">
      {saving ? "Guardando..." : label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>;
}
