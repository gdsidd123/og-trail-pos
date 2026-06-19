import { useCallback, useEffect, useMemo, useState } from 'react';
import { BootstrapResponse, CartItem, customerBootstrap, customerSubmitOrder } from './api';

function getTokenFromPath() {
  const match = window.location.pathname.match(/\/t\/([^/]+)/);
  return match?.[1] || '';
}

function formatPrice(value: number) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export function App() {
  const token = useMemo(getTokenFromPath, []);
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const loadOrderPage = useCallback(async (showLoader = false) => {
    if (!token) {
      setError('Invalid QR link. Please scan the table QR again.');
      setLoading(false);
      return;
    }

    if (showLoader) setLoading(true);
    setError(null);
    const response = await customerBootstrap(token);
    setData(response);
    setSelectedCategoryId((currentCategoryId) => currentCategoryId ?? response.categories[0]?.id ?? null);
    if (showLoader) setLoading(false);
  }, [token]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await loadOrderPage(true);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load menu.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [loadOrderPage]);

  const visibleItems = useMemo(() => {
    if (!data || selectedCategoryId == null) return [];
    return data.menuItems.filter((item) => item.category_id === selectedCategoryId);
  }, [data, selectedCategoryId]);

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const submittedQuantity = data?.activeOrder?.totalQuantity ?? 0;
  const submittedTotal = data?.activeOrder?.totalAmount ?? 0;
  const orderHasPhone = data?.activeOrder?.hasCustomerPhone ?? false;
  const phoneDigits = customerPhone.replace(/\D/g, '');
  const last4Digits = phoneLast4.replace(/\D/g, '').slice(-4);

  const addItem = (item: BootstrapResponse['menuItems'][number]) => {
    setSuccessMessage(null);
    setCart((current) => {
      const existing = current.find((cartItem) => String(cartItem.id) === String(item.id));
      if (existing) {
        return current.map((cartItem) => String(cartItem.id) === String(item.id)
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem);
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const changeQuantity = (id: string | number, delta: number) => {
    setCart((current) => current
      .map((item) => String(item.id) === String(id) ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const removeItem = (id: string | number) => {
    setCart((current) => current.filter((item) => String(item.id) !== String(id)));
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setPhoneError(null);
    if (orderHasPhone) {
      if (last4Digits.length !== 4) {
        setPhoneError('Enter the last 4 digits before placing order.');
        return;
      }
    } else if (phoneDigits.length < 10) {
      setPhoneError('Add mobile number before placing order.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await customerSubmitOrder(token, cart, orderHasPhone ? { phoneLast4: last4Digits } : { customerPhone: phoneDigits });
      setCart([]);
      setPhoneLast4('');
      await loadOrderPage(false);
      setSuccessMessage(`${response.submittedItems} item${response.submittedItems === 1 ? '' : 's'} sent to the kitchen.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="center-screen"><div className="loader" /><p>Loading menu...</p></main>;
  }

  if (error && !data) {
    return (
      <main className="center-screen">
        <section className="message-card">
          <h1>Invalid QR</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">OG Trail Cafe</p>
          <h1>{data.table.name}</h1>
        </div>
        <div className="cart-pill">{itemCount} in cart</div>
      </header>

      {submittedQuantity > 0 ? (
        <section className="submitted-summary">
          <strong>{submittedQuantity} items ordered</strong>
          <span>{formatPrice(submittedTotal)}</span>
        </section>
      ) : null}

      {successMessage ? <div className="success-banner">{successMessage}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <nav className="category-row" aria-label="Menu categories">
        {data.categories.map((category) => (
          <button
            key={category.id}
            className={category.id === selectedCategoryId ? 'category active' : 'category'}
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </nav>

      <section className="menu-list">
        {visibleItems.length === 0 ? (
          <p className="muted">No available items in this category.</p>
        ) : visibleItems.map((item) => (
          <article key={item.id} className="menu-item">
            <div>
              <h2>{item.name}</h2>
              <p>{formatPrice(item.price)}</p>
            </div>
            <button onClick={() => addItem(item)}>Add</button>
          </article>
        ))}
      </section>

      <section className="cart-panel" aria-label="Cart">
        <div className="cart-header">
          <h2>Your Cart</h2>
          <strong>{formatPrice(total)}</strong>
        </div>
        <div className="phone-panel">
          {orderHasPhone ? (
            <>
              <label htmlFor="phone-last4">Confirm last 4 digits <span>*</span></label>
              <div className="phone-help">Mobile number saved for this table.</div>
              <input
                id="phone-last4"
                className={phoneError ? 'input-error' : undefined}
                inputMode="numeric"
                maxLength={4}
                value={phoneLast4}
                onChange={(event) => {
                  setPhoneError(null);
                  setPhoneLast4(event.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                placeholder="Last 4 digits"
              />
            </>
          ) : (
            <>
              <label htmlFor="customer-phone">Mobile number <span>*</span></label>
              <input
                id="customer-phone"
                className={phoneError ? 'input-error' : undefined}
                inputMode="tel"
                value={customerPhone}
                onChange={(event) => {
                  setPhoneError(null);
                  setCustomerPhone(event.target.value.replace(/\D/g, '').slice(0, 15));
                }}
                placeholder="Enter mobile number"
              />
            </>
          )}
          {phoneError ? <div className="field-error">{phoneError}</div> : null}
        </div>
        {cart.length === 0 ? (
          <p className="muted">Add items to send a new kitchen order.</p>
        ) : cart.map((item) => (
          <div key={item.id} className="cart-row">
            <div>
              <strong>{item.name}</strong>
              <p>{formatPrice(item.price)} each</p>
            </div>
            <div className="qty-row">
              <button onClick={() => changeQuantity(item.id, -1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => changeQuantity(item.id, 1)}>+</button>
              <button className="remove" onClick={() => removeItem(item.id)}>Remove</button>
            </div>
          </div>
        ))}
        <button className="submit-button" onClick={submitOrder} disabled={submitting || cart.length === 0}>
          {submitting ? 'Sending...' : 'Save Order'}
        </button>
      </section>

      <section className="ordered-panel" aria-label="Already ordered items">
        <div className="cart-header">
          <h2>Already Ordered</h2>
          <strong>{submittedQuantity} items</strong>
        </div>
        {!data.activeOrder || data.activeOrder.items.length === 0 ? (
          <p className="muted">Saved items will appear here after you order.</p>
        ) : data.activeOrder.items.map((item) => (
          <div key={item.id} className="ordered-row">
            <div>
              <strong>{item.name}</strong>
              <p>{item.quantity} x {formatPrice(Number(item.unit_price))}</p>
            </div>
            <span className={`status ${item.kot_status}`}>{item.kot_status}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

