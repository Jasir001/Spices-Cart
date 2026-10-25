import { useEffect, useMemo, useState } from 'react';
import { apiUrl, serverApiEnabled } from './api';

type Product = {
  id: string;
  name: string;
  tamilName: string;
  category: string;
  image?: string;
  imageAlt: string;
  isDemo?: boolean;
  orderable?: boolean;
  variants: { weight: string; price: number; available?: boolean }[];
};
type CartLine = { productId: string; weight: string; quantity: number };
type Language = 'en' | 'ta';

const pageLabels = {
  en: {
    shop: 'Shop', wishlist: 'Wishlist', cart: 'Cart', account: 'Account', search: 'Search',
    searchPlaceholder: 'Search spices', viewProduct: 'View product', sampleFrom: 'Sample listing price from',
    detailsUnavailable: 'Availability, ingredients, SKU, origin, and verified product details have not been provided.',
    packSize: 'Pack size', addToCart: 'Add to cart', save: 'Save to wishlist', removeSaved: 'Remove from wishlist',
    demoNotice: 'Cart and wishlist are stored in this browser only. Checkout is not configured.',
    cartTitle: 'Your shopping cart', cartEmpty: 'Your cart is waiting for something spicy!', quantity: 'Quantity', remove: 'Remove',
    subtotal: 'Items subtotal', cartNotice: 'Items are for reference only. Checkout is disabled until the store configuration and order operations are ready.',
    checkout: 'Proceed to checkout', continueShopping: 'Continue shopping', wishlistTitle: 'Your wishlist', wishlistEmpty: 'Your wishlist is empty. Save a product to see it here.',
    searchTitle: 'Search results', noQuery: 'Enter a spice or category to search.', noResults: 'No products match this selection.',
    backHome: 'Back to home', browse: 'Browse products',
  },
  ta: {
    shop: 'மசாலா வாங்க', wishlist: 'விருப்பப்பட்டியல்', cart: 'கூடை', account: 'கணக்கு', search: 'தேடு',
    searchPlaceholder: 'மசாலா தேடுங்கள்', viewProduct: 'பொருளைப் பார்க்க', sampleFrom: 'மாதிரி பட்டியல் விலை',
    detailsUnavailable: 'இருப்பு, சேர்மங்கள், SKU, மூலம் மற்றும் சரிபார்க்கப்பட்ட பொருள் விவரங்கள் வழங்கப்படவில்லை.',
    packSize: 'பொதி அளவு', addToCart: 'கூடையில் சேர்', save: 'விருப்பப்பட்டியலில் சேர்', removeSaved: 'விருப்பப்பட்டியலிலிருந்து நீக்கு',
    demoNotice: 'கூடை மற்றும் விருப்பப்பட்டியல் இந்த உலாவியில் மட்டுமே சேமிக்கப்படும். Checkout அமைக்கப்படவில்லை.',
    cartTitle: 'உங்கள் கூடை', cartEmpty: 'உங்கள் கூடை காலியாக உள்ளது. சுவையான மசாலாக்களைத் தேடுங்கள்!', quantity: 'எண்ணிக்கை', remove: 'நீக்கு',
    subtotal: 'பொருட்களின் இடைத்தொகை', cartNotice: 'இந்தப் பொருட்கள் குறிப்புக்காக மட்டுமே. கடை அமைப்பும் ஆர்டர் செயல்பாடுகளும் தயாராகும் வரை Checkout முடக்கப்பட்டுள்ளது.',
    checkout: 'Checkout-க்குச் செல்லுங்கள்', continueShopping: 'தொடர்ந்து வாங்குங்கள்', wishlistTitle: 'உங்கள் விருப்பப்பட்டியல்', wishlistEmpty: 'விருப்பப்பட்டியல் காலியாக உள்ளது. பொருளைச் சேமித்தால் இங்கே தெரியும்.',
    searchTitle: 'தேடல் முடிவுகள்', noQuery: 'தேட மசாலா அல்லது வகையை உள்ளிடுங்கள்.', noResults: 'இந்தத் தேர்வுக்கு பொருட்கள் இல்லை.',
    backHome: 'முகப்புக்குத் திரும்பு', browse: 'பொருட்களைப் பாருங்கள்',
  },
} satisfies Record<Language, Record<string, string>>;

type StorePagesProps = {
  pathname: string;
  search: string;
  language: Language;
  products: Product[];
  wishlist: string[];
  cart: CartLine[];
  cartPersistenceMessage: string;
  onLanguageToggle: () => void;
  onAddToCart: (product: Product, weight: string) => boolean;
  onWishlistToggle: (productId: string) => void;
  onCartQuantityChange: (productId: string, weight: string, quantity: number) => void;
};

const categoryRoutes: Record<string, string> = {
  '/categories/whole-spices': 'Whole Spices',
  '/categories/ground-spices': 'Ground Spices',
  '/categories/masalas': 'Signature Masalas',
  '/categories/gift-boxes': 'Gift Boxes',
  '/collections/premium': 'Premium Collections',
};

type StoreConfiguration = {
  name: string | null;
  legalName: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  shippingPolicyUrl: string | null;
  returnsPolicyUrl: string | null;
  privacyPolicyUrl: string | null;
  termsPolicyUrl: string | null;
};

function StoreConfigurationPage({ pathname }: { pathname: string }) {
  const [configuration, setConfiguration] = useState<StoreConfiguration | null>(null);
  const [error, setError] = useState('');
  const page = informationPages[pathname] ?? { title: 'Store information', body: ['Store information is not available.'] };

  useEffect(() => {
    if (!serverApiEnabled) return;
    let cancelled = false;
    void fetch(apiUrl('/api/store/config'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Store configuration request failed (${response.status}).`);
        return response.json() as Promise<StoreConfiguration>;
      })
      .then((result) => { if (!cancelled) setConfiguration(result); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Store configuration could not be loaded.');
      });
    return () => { cancelled = true; };
  }, []);

  const configuredPolicyUrl = pathname === '/shipping' ? configuration?.shippingPolicyUrl
    : pathname === '/returns' ? configuration?.returnsPolicyUrl
      : pathname === '/privacy' ? configuration?.privacyPolicyUrl
        : pathname === '/terms' ? configuration?.termsPolicyUrl : null;

  if (pathname !== '/contact') {
    const body = configuredPolicyUrl
      ? [`The store owner has configured the policy below. Review its full text before placing any order.`]
      : page.body;
    return (
      <section className="store-message-panel" aria-labelledby="store-page-heading">
        <p className="eyebrow">SPICE CART · STORE INFORMATION</p>
        <h1 id="store-page-heading">{page.title}</h1>
        {body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {configuredPolicyUrl && <p><a href={configuredPolicyUrl} target="_blank" rel="noreferrer">{page.title}</a></p>}
        {error && <p role="alert">Store policy configuration could not be loaded: {error}</p>}
      </section>
    );
  }

  const fields = [
    ['Business name', configuration?.legalName],
    ['Trading name', configuration?.name],
    ['Business address', configuration?.address],
    ['Email', configuration?.contactEmail],
    ['Phone', configuration?.contactPhone],
  ] as const;
  const configuredFields = fields.filter(([, value]) => value);
  return (
    <section className="store-message-panel" aria-labelledby="store-page-heading">
      <p className="eyebrow">SPICE CART · STORE INFORMATION</p>
      <h1 id="store-page-heading">{page.title}</h1>
      {error && <p role="alert">Store contact configuration could not be loaded: {error}</p>}
      {configuredFields.length
        ? <dl className="store-contact-details">{configuredFields.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{label === 'Email' ? <a href={`mailto:${value}`}>{value}</a>
            : label === 'Phone' ? <a href={`tel:${value}`}>{value}</a> : value}</dd></div>
        ))}</dl>
        : <p>{page.body[0]}</p>}
      <p>Contact details are shown only after the store owner configures and verifies them.</p>
    </section>
  );
}

const informationPages: Record<string, { title: string; body: string[] }> = {
  '/about': {
    title: 'About SPICE CART',
    body: ['SPICE CART is a spice storefront preview for browsing listed products and pack sizes.', 'Product sourcing, business contact details, and packaging information must be confirmed by the store owner before launch.'],
  },
  '/contact': {
    title: 'Contact SPICE CART',
    body: ['Contact details have not been provided yet. Orders, customer support, and returns cannot be handled through this preview.'],
  },
  '/faq': {
    title: 'Frequently asked questions',
    body: ['Can I place an order? Online checkout is not configured.', 'Are product prices live? No. Catalog prices are sample listing values; confirm them with the store owner.', 'Can I see market prices? The market page accepts a source-attributed local CSV preview; it does not display verified live prices.'],
  },
  '/shipping': {
    title: 'Shipping and delivery',
    body: ['Shipping rates, delivery regions, carrier, and delivery estimates have not been configured. No delivery commitment is made by this preview.'],
  },
  '/returns': {
    title: 'Returns and refunds',
    body: ['A store-approved return and refund policy and a support contact have not been configured. Please do not accept customer orders until these details are in place.'],
  },
  '/privacy': {
    title: 'Privacy information',
    body: ['This frontend stores cart, wishlist, and language preferences in the current browser. There is no customer account or server-side customer database.', 'A reviewed privacy policy is required before collecting customer information or launching analytics, email, or payment integrations.'],
  },
  '/terms': {
    title: 'Terms and conditions',
    body: ['This storefront is a preview, not an offer to sell. Product prices are sample values and checkout is unavailable.', 'Store-specific terms must be reviewed and supplied before launch.'],
  },
  '/recipes': {
    title: 'Recipe journal',
    body: ['Recipe names are editorial placeholders; verified ingredients, instructions, and recipe-to-cart data are not configured yet.'],
  },
  '/account': {
    title: 'Customer account',
    body: ['Registration, login, profile, addresses, and order history require a secure backend and have not been configured. No account data is collected.'],
  },
  '/login': {
    title: 'Sign in',
    body: ['Secure customer authentication is unavailable because this project has no authentication backend.'],
  },
  '/register': {
    title: 'Create an account',
    body: ['Customer registration is unavailable because this project has no authentication backend.'],
  },
  '/profile': {
    title: 'Your profile and addresses',
    body: ['Profiles and saved delivery addresses require authenticated server storage and are not available in this preview.'],
  },
  '/orders': {
    title: 'Order history',
    body: ['There is no order service or order history. No order has been created by this preview.'],
  },
  '/tracking': {
    title: 'Order tracking',
    body: ['Shipment tracking is unavailable because no shipping provider or order backend is connected.'],
  },
  '/collections/premium': {
    title: 'Premium spice collections',
    body: ['No separately verified premium collection catalog has been provided. Browse the available product catalog instead.'],
  },
};

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function ProductLinks({ items, language }: { items: Product[]; language: Language }) {
  const t = pageLabels[language];
  if (!items.length) {
    return <p className="store-empty">{t.noResults}</p>;
  }
  return (
    <div className="product-grid store-product-grid">
      {items.map((product) => {
        const variant = product.variants[0];
        return (
          <article key={product.id} className="product-card">
            <a className="product-image-wrap store-product-image" href={`/products/${product.id}`}>
              {product.image
                ? <img src={product.image} alt={product.imageAlt} loading="lazy" />
                : <div className="photo-placeholder" role="img" aria-label={product.imageAlt}><span>Photo unavailable</span></div>}
            </a>
            <div className="product-body">
              <span className="store-category-label">{product.category}</span>
              <h2><a href={`/products/${product.id}`}>{language === 'ta' ? product.tamilName : product.name}</a></h2>
              <p className="store-sample-price">{product.isDemo ? `${t.sampleFrom} ` : ''}{formatPrice(variant.price)}{product.isDemo ? '' : ' · catalog price'}</p>
              <a className="secondary-btn" href={`/products/${product.id}`}>{t.viewProduct}</a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function UnavailablePage({ title, body, language }: { title: string; body: string[]; language: Language }) {
  const t = pageLabels[language];
  return (
    <section className="store-message-panel" aria-labelledby="store-page-heading">
      <p className="eyebrow">SPICE CART · SPICES AND MORE</p>
      <h1 id="store-page-heading">{title}</h1>
      {body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <div className="store-page-actions">
        <a className="primary-btn" href="/">{t.backHome}</a>
        <a className="secondary-btn" href="/shop">{t.browse}</a>
      </div>
    </section>
  );
}

export default function StorePages({
  pathname, search, language, products, wishlist, cart,
  cartPersistenceMessage, onLanguageToggle, onAddToCart, onWishlistToggle, onCartQuantityChange,
}: StorePagesProps) {
  const t = pageLabels[language];
  const [selectedWeight, setSelectedWeight] = useState('');
  const [cartFeedback, setCartFeedback] = useState('');
  const productId = pathname.startsWith('/products/') ? pathname.slice('/products/'.length) : '';
  const product = products.find((item) => item.id === productId);
  const query = new URLSearchParams(search).get('q')?.trim() ?? '';
  const category = categoryRoutes[pathname];
  const searchedProducts = useMemo(() => {
    const normalized = query.toLocaleLowerCase();
    return products.filter((item) => [item.name, item.tamilName, item.category]
      .some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [products, query]);
  const cartLines = cart.flatMap((line) => {
    const item = products.find((entry) => entry.id === line.productId);
    const variant = item?.variants.find((entry) => entry.weight === line.weight);
    return item && variant ? [{ product: item, weight: line.weight, quantity: line.quantity, price: variant.price }] : [];
  });
  const cartTotal = cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const containsDemoProducts = cartLines.some((line) => line.product.isDemo);

  let content;
  if (product) {
    const currentVariant = product.variants.find((variant) => variant.weight === selectedWeight)
      ?? product.variants[0];
    content = (
      <section className="store-product-detail">
        <a className="market-back" href="/shop">← Shop all spices</a>
        <div className="store-detail-grid">
          <div className="store-detail-image">
            {product.image
              ? <img src={product.image} alt={product.imageAlt} />
              : <div className="photo-placeholder" role="img" aria-label={product.imageAlt}><span>Authentic product photography not available</span></div>}
          </div>
          <div className="store-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{language === 'ta' ? product.tamilName : product.name}</h1>
            <p>{formatPrice(currentVariant.price)} {product.isDemo
              ? <span className="store-sample-price">· {t.sampleFrom.toLocaleLowerCase()}</span>
              : <span className="store-sample-price">· catalog price</span>}</p>
            <p>{t.detailsUnavailable}</p>
            <label className="weight-picker">
              <span>{t.packSize}</span>
              <select value={currentVariant.weight} onChange={(event) => setSelectedWeight(event.target.value)}>
                {product.variants.map((variant) => <option key={variant.weight} value={variant.weight}
                  disabled={!product.isDemo && variant.available === false}>{variant.weight} · {formatPrice(variant.price)}</option>)}
              </select>
            </label>
            <div className="store-page-actions">
              <button className="primary-btn" disabled={!product.isDemo && (!product.orderable || currentVariant.available === false)} onClick={() => {
                const added = onAddToCart(product, currentVariant.weight);
                  setCartFeedback(added
                  ? `${language === 'ta' ? product.tamilName : product.name} · ${currentVariant.weight} added to your cart.`
                  : 'Could not add this pack. The maximum quantity may have been reached.');
              }}>{t.addToCart}</button>
              <button className="secondary-btn" onClick={() => onWishlistToggle(product.id)}>
                {wishlist.includes(product.id) ? t.removeSaved : t.save}
              </button>
            </div>
            {!product.isDemo && (!product.orderable || currentVariant.available === false)
              && <p className="store-notice" role="status">This pack is currently unavailable or out of stock.</p>}
            {cartFeedback && <p className="store-cart-feedback" role="status">{cartFeedback}</p>}
            <p className="store-notice">{cartPersistenceMessage}</p>
          </div>
        </div>
      </section>
    );
  } else if (pathname === '/cart') {
    content = (
      <section className="store-content-page">
        <p className="eyebrow">SPICE CART · SPICES AND MORE</p>
        <h1>{t.cartTitle}</h1>
        {!cartLines.length ? (
          <div className="store-cart-empty">
            <span className="store-cart-empty-icon" aria-hidden="true">✦</span>
            <p>{t.cartEmpty}</p>
            <a className="primary-btn" href="/shop">{t.browse}</a>
          </div>
        ) : (
          <>
            <div className="store-cart-lines">
              {cartLines.map((line) => (
                <article className="store-cart-line" key={`${line.product.id}-${line.weight}`}>
                  <a className="store-cart-product-image" href={`/products/${line.product.id}`} aria-label={`View ${line.product.name}`}>
                    {line.product.image
                      ? <img src={line.product.image} alt="" loading="lazy" />
                      : <span aria-hidden="true">✦</span>}
                  </a>
                  <div className="store-cart-product-details">
                    <span className="store-category-label">{line.product.category}</span>
                    <a href={`/products/${line.product.id}`}><strong>{language === 'ta' ? line.product.tamilName : line.product.name}</strong></a>
                    <span>{t.packSize}: {line.weight}</span>
                    <span>{line.product.isDemo ? `${t.sampleFrom} ` : ''}{formatPrice(line.price)} / pack</span>
                  </div>
                  <div className="store-cart-quantity">
                    <span>{t.quantity}</span>
                    <div className="quantity-control">
                      <button type="button" onClick={() => onCartQuantityChange(line.product.id, line.weight, line.quantity - 1)} aria-label={`Decrease ${line.product.name} quantity`} disabled={line.quantity <= 1}>−</button>
                      <output aria-label={`${line.quantity} items`}>{line.quantity}</output>
                      <button type="button" onClick={() => onCartQuantityChange(line.product.id, line.weight, line.quantity + 1)} aria-label={`Increase ${line.product.name} quantity`} disabled={line.quantity >= 99}>+</button>
                    </div>
                  </div>
                  <div className="store-cart-item-total">
                    <span>{line.product.isDemo ? 'Sample item subtotal' : 'Item subtotal'}</span>
                    <strong>{formatPrice(line.quantity * line.price)}</strong>
                  </div>
                  <button className="store-cart-remove" type="button" onClick={() => onCartQuantityChange(line.product.id, line.weight, 0)}>{t.remove}</button>
                </article>
              ))}
            </div>
            <aside className="store-cart-summary" aria-label="Cart summary">
              <div className="store-cart-total"><span>{containsDemoProducts ? (language === 'ta' ? 'மாதிரி இடைத்தொகை' : 'Sample subtotal') : t.subtotal}</span><strong>{formatPrice(cartTotal)}</strong></div>
              <p>{cartPersistenceMessage} {containsDemoProducts ? 'Sample catalog values are not prices for customer orders. ' : ''}{t.cartNotice}</p>
              <div className="store-cart-actions">
                <a className="secondary-btn" href="/shop">{t.continueShopping}</a>
                <a className="primary-btn" href="/checkout">{t.checkout}</a>
              </div>
            </aside>
          </>
        )}
      </section>
    );
  } else if (pathname === '/wishlist') {
    const savedProducts = products.filter((item) => wishlist.includes(item.id));
    content = <section className="store-content-page"><h1>{t.wishlistTitle}</h1>{savedProducts.length ? <ProductLinks items={savedProducts} language={language} /> : <p className="store-empty">{t.wishlistEmpty}</p>}</section>;
  } else if (pathname === '/search') {
    content = <section className="store-content-page"><h1>{t.searchTitle}</h1><p>{query ? `Results for “${query}”` : t.noQuery}</p><ProductLinks items={query ? searchedProducts : []} language={language} /></section>;
  } else if (pathname === '/account') {
    content = (
      <section className="store-message-panel" aria-labelledby="store-page-heading">
        <p className="eyebrow">SPICE CART · CUSTOMER ACCOUNT</p>
        <h1 id="store-page-heading">Customer account</h1>
        <p>Sign in or create an account to view your customer account.</p>
        <div className="store-page-actions">
          <a className="primary-btn" href="/login">Sign in</a>
          <a className="secondary-btn" href="/register">Create an account</a>
        </div>
      </section>
    );
  } else if (pathname === '/shop' || pathname === '/shop-all') {
    content = <section className="store-content-page"><h1>Shop all spices</h1><ProductLinks items={products} language={language} /></section>;
  } else if (pathname === '/collections/combos') {
    content = <UnavailablePage title="Combo packs" body={['No verified combo products, component lists, or approved bundle prices have been provided. Browse current sample catalog listings instead.']} language={language} />;
  } else if (pathname.startsWith('/recipes/')) {
    content = <UnavailablePage title="Recipe details are not available" body={['Verified ingredient lists, preparation instructions, and recipe-to-cart information have not been supplied.']} language={language} />;
  } else if (pathname.startsWith('/orders/')) {
    content = <UnavailablePage title="Order details are not available" body={['No order service or order records are connected. This preview cannot look up or track an order.']} language={language} />;
  } else if (pathname.startsWith('/tracking/')) {
    content = <UnavailablePage title="Shipment tracking is not available" body={['No shipping provider or order backend is connected.']} language={language} />;
  } else if (category) {
    const items = category === 'Premium Collections' ? [] : products.filter((item) => item.category === category);
    content = <section className="store-content-page"><h1>{category}</h1>{category === 'Premium Collections' && <p>No verified premium-specific collection data is available yet.</p>}<ProductLinks items={items} language={language} /></section>;
  } else if (['/contact', '/shipping', '/returns', '/privacy', '/terms'].includes(pathname)) {
    content = <StoreConfigurationPage pathname={pathname} />;
  } else if (informationPages[pathname]) {
    const page = informationPages[pathname];
    content = <UnavailablePage title={page.title} body={page.body} language={language} />;
  } else {
    content = <UnavailablePage title="Page not found" body={['This SPICE CART page does not exist.']} language={language} />;
  }

  return (
    <div className="store-pages-shell">
      <header className="store-pages-header">
        <a href="/" aria-label="SPICE CART home"><img src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" /></a>
        <nav aria-label="Store navigation">
          <a href="/shop" aria-current={pathname === '/shop' || pathname.startsWith('/products/') ? 'page' : undefined}>{t.shop}</a>
          <a href="/wishlist" aria-current={pathname === '/wishlist' ? 'page' : undefined}>{t.wishlist} ({wishlist.length})</a>
          <a href="/cart" aria-current={pathname === '/cart' ? 'page' : undefined}>{t.cart} ({cart.reduce((count, line) => count + line.quantity, 0)})</a>
          <a href="/login" aria-current={pathname === '/login' || pathname === '/account' ? 'page' : undefined}>{t.account}</a>
        </nav>
        <form className="store-route-search" action="/search">
          <label className="sr-only" htmlFor="store-route-search">{t.search}</label>
          <input id="store-route-search" name="q" type="search" placeholder={t.searchPlaceholder} defaultValue={pathname === '/search' ? query : ''} />
          <button type="submit" aria-label={t.search}>{t.search}</button>
        </form>
        <button className="language-button" onClick={onLanguageToggle}>{language === 'en' ? 'தமிழ்' : 'English'}</button>
      </header>
      <main className="store-pages-main">{content}</main>
      <footer className="store-pages-footer">
        <a href="/">SPICE CART</a><span>SPICES AND MORE</span>
        <nav aria-label="Policies and help">
          <a href="/about">About</a><a href="/contact">Contact</a><a href="/faq">FAQ</a>
          <a href="/shipping">Shipping</a><a href="/returns">Returns</a>
          <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/market-prices">Market prices</a>
        </nav>
      </footer>
    </div>
  );
}
