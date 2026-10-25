import { useEffect, useMemo, useRef, useState } from 'react';
import MarketPrices from './MarketPrices';
import StorePages from './StorePages';
import AuthPages from './AuthPages';
import { CheckoutPage, OrderStatusPage } from './CheckoutPages';
import { products, type Product } from '../shared/catalog';
import { apiUrl, serverApiEnabled } from './api';

type Language = 'en' | 'ta';
type CartLine = { productId: string; weight: string; quantity: number };

const categories = [
  { name: 'Whole Spices', tamilName: 'முழு மசாலா', icon: '🌿', description: 'Whole spice classics for your pantry.' },
  { name: 'Ground Spices', tamilName: 'அரை மசாலா', icon: '✦', description: 'Ground spices for everyday cooking.' },
  { name: 'Signature Masalas', tamilName: 'சிறப்பு மசாலா', icon: '🥘', description: 'Masala blends for familiar recipes.' },
  { name: 'Gift Boxes', tamilName: 'பரிசுப் பெட்டிகள்', icon: '🎁', description: 'Spice assortments in gift-ready sizes.' },
];

const copy = {
  en: {
    shop: 'Shop spices', categories: 'Categories', story: 'Our story', reviews: 'Customer feedback',
    cart: 'Cart', wishlist: 'Wishlist', heroEyebrow: 'A little more flavour in every day',
    heroTitle: 'GOOD FOOD STARTS WITH GREAT SPICE.',
    heroText: 'Explore whole spices, fragrant powders, and bold masala blends for your home cooking.',
    shopNow: 'Shop our spices', explore: 'Explore categories', categoryEyebrow: 'Curated by category',
    categoryTitle: 'Shop by category', productEyebrow: 'Catalog preview', productTitle: 'Shop all spices',
    search: 'Search spices...', all: 'All spices', sort: 'Sort by', featured: 'Catalog order',
    priceLow: 'Price: low to high', priceHigh: 'Price: high to low',
    favoritesOnly: 'Show wishlist', noProducts: 'No spices match your search.',
    origin: 'Category', add: 'Add to cart', added: 'added to your cart.',
    chooseWeight: 'Choose pack size', cartTitle: 'Your cart', emptyCart: 'Your cart is empty.',
    subtotal: 'Subtotal', continueShopping: 'Continue shopping', remove: 'Remove',
    checkoutUnavailable: 'Online checkout is not set up yet.',
  },
  ta: {
    shop: 'மசாலா வாங்க', categories: 'வகைகள்', story: 'எங்கள் கதை', reviews: 'வாடிக்கையாளர் கருத்து',
    cart: 'கூடை', wishlist: 'விருப்பங்கள்', heroEyebrow: 'ஒவ்வொரு நாளும் சிறிது கூடுதல் சுவை',
    heroTitle: 'சிறந்த மசாலாவில் தொடங்குகிறது சிறந்த உணவு.',
    heroText: 'முழு மசாலாக்கள், மணமிக்க பொடிகள் மற்றும் சுவையான மசாலா கலவைகளைப் பாருங்கள்.',
    shopNow: 'மசாலா வாங்குங்கள்', explore: 'வகைகளைப் பாருங்கள்', categoryEyebrow: 'தேர்ந்தெடுத்த வகைகள்',
    categoryTitle: 'வகை வாரியாக வாங்குங்கள்', productEyebrow: 'பட்டியல் முன்னோட்டம்', productTitle: 'அனைத்து மசாலாக்களும்',
    search: 'மசாலா தேடுங்கள்...', all: 'அனைத்தும்', sort: 'வரிசைப்படுத்து', featured: 'பட்டியல் வரிசை',
    priceLow: 'விலை: குறைவிலிருந்து', priceHigh: 'விலை: அதிகத்திலிருந்து',
    favoritesOnly: 'விருப்பங்களை மட்டும்', noProducts: 'தேடலுக்கு பொருத்தமான மசாலா இல்லை.',
    origin: 'வகை', add: 'கூடையில் சேர்', added: 'உங்கள் கூடையில் சேர்க்கப்பட்டது.',
    chooseWeight: 'பொதி அளவைத் தேர்ந்தெடுக்கவும்', cartTitle: 'உங்கள் கூடை', emptyCart: 'உங்கள் கூடை காலியாக உள்ளது.',
    subtotal: 'மொத்தம்', continueShopping: 'தொடர்ந்து வாங்குங்கள்', remove: 'நீக்கு',
    checkoutUnavailable: 'இணையவழி கட்டணம் இன்னும் அமைக்கப்படவில்லை.',
  },
} satisfies Record<Language, Record<string, string>>;

function readStored<T>(key: string, fallback: T): T {
  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch (error) {
    console.error(`Could not restore ${key} from local storage.`, error);
    return fallback;
  }
}

function normalizeCart(value: unknown, catalog: Product[] = products): CartLine[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap((candidate): CartLine[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const line = candidate as Record<string, unknown>;
    if (typeof line.productId !== 'string' || typeof line.weight !== 'string'
      || typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1) return [];
    const product = catalog.find((item) => item.id === line.productId);
    const variantExists = product?.variants.some((variant) => variant.weight === line.weight);
    if (!product || !variantExists) return [];
    return [{ productId: product.id, weight: line.weight, quantity: line.quantity }];
  });
  const merged = new Map<string, CartLine>();
  for (const line of normalized) {
    const key = `${line.productId}:${line.weight}`;
    const existing = merged.get(key);
    merged.set(key, { ...line, quantity: Math.min(99, (existing?.quantity ?? 0) + line.quantity) });
  }
  return [...merged.values()];
}

function normalizeWishlist(value: unknown, catalog: Product[] = products): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && catalog.some((product) => product.id === id)))];
}

type CartApiResponse = { items: unknown; scope?: 'guest' | 'customer' };
type ProductApiResponse = { items?: Product[] };

async function requestCartApi(path: string, method = 'GET', body?: unknown): Promise<CartApiResponse> {
  const headers = new Headers();
  if (body !== undefined) {
    const csrfResponse = await fetch(apiUrl('/api/auth/csrf'), { credentials: 'include' });
    const csrfResult = await csrfResponse.json() as { csrfToken?: string };
    if (!csrfResponse.ok || !csrfResult.csrfToken) throw new Error('Could not start a secure cart session.');
    headers.set('Content-Type', 'application/json');
    headers.set('X-CSRF-Token', csrfResult.csrfToken);
  }
  const response = await fetch(apiUrl(`/api/cart${path}`), {
    method,
    headers,
    credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as CartApiResponse & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The saved cart could not be updated.');
  return result;
}

const collections = [
  { title: 'The Essentials', tag: 'Everyday pantry', accent: 'gold' },
  { title: 'Limited Editions', tag: 'Rare harvests', accent: 'amber' },
  { title: 'Curated Gift Kits', tag: 'Thoughtful gifting', accent: 'bronze' },
  { title: 'Seasonal Collections', tag: 'Festive flavors', accent: 'gold' },
];

const recipes = [
  'Mutton Rogan Josh',
  'Saffron Rice Pilaf',
  'Coconut Curry',
  'Smoked Lentil Soup',
  'Ceylon Tea Cake',
];

function App() {
  const [cart, setCart] = useState<CartLine[]>(() => normalizeCart(readStored<unknown>('spice-cart-items', [])));
  const cartRef = useRef(cart);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const catalogRef = useRef(catalogProducts);
  const [catalogReady, setCatalogReady] = useState(!serverApiEnabled);
  const [catalogError, setCatalogError] = useState('');
  const [cartPersistence, setCartPersistence] = useState<'checking' | 'server' | 'browser'>('checking');
  const [cartPersistenceMessage, setCartPersistenceMessage] = useState('Restoring your saved cart…');
  const cartMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const [wishlist, setWishlist] = useState<string[]>(() => normalizeWishlist(readStored<unknown>('spice-cart-wishlist', [])));
  const [language, setLanguage] = useState<Language>(() => readStored<unknown>('spice-cart-language', 'en') === 'ta' ? 'ta' : 'en');
  const [selectedWeights, setSelectedWeights] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [maxPrice, setMaxPrice] = useState(1500);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [cartMessage, setCartMessage] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const t = copy[language];
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const product = pathname.startsWith('/products/')
      ? catalogProducts.find((item) => item.id === pathname.slice('/products/'.length))
      : undefined;
    const routeName = pathname === '/market-prices'
      ? 'Market Prices'
      : pathname === '/shop' || pathname === '/shop-all'
        ? 'Shop Spices'
        : pathname === '/cart'
          ? 'Shopping Cart'
          : pathname === '/wishlist'
            ? 'Wishlist'
            : pathname === '/search'
              ? 'Search'
              : pathname === '/' ? '' : pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ');
    document.title = product
      ? `${product.name} | SPICE CART — SPICES AND MORE`
      : routeName
        ? `${routeName.replace(/\b\w/g, (letter) => letter.toUpperCase())} | SPICE CART — SPICES AND MORE`
        : 'SPICE CART — SPICES AND MORE';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      product
        ? `Browse ${product.name} pack options at SPICE CART. Catalog prices are sample listings.`
        : 'SPICE CART — SPICES AND MORE. Browse the spice catalog and its currently available storefront features.',
    );
  }, [catalogProducts]);
  useEffect(() => {
    const updateScrollState = () => setTopbarScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const elements = document.querySelectorAll<HTMLElement>('.section:not(.hero), .site-footer');
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-revealed', 'true');
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    elements.forEach((element) => {
      element.setAttribute('data-reveal', 'true');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  const cartTotal = cart.reduce((total, line) => {
    const product = catalogProducts.find((item) => item.id === line.productId);
    const variant = product?.variants.find((item) => item.weight === line.weight);
    return total + (variant?.price ?? 0) * line.quantity;
  }, 0);
  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const matchingProducts = catalogProducts.filter((product) => {
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesSearch = !normalizedSearch || [
        product.name,
        product.tamilName,
        product.category,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      const selectedVariant = product.variants.find((variant) => variant.weight === selectedWeights[product.id])
        ?? product.variants[1] ?? product.variants[0];
      const matchesPrice = selectedVariant.price <= maxPrice;
      const matchesWishlist = !wishlistOnly || wishlist.includes(product.id);
      return matchesCategory && matchesSearch && matchesPrice && matchesWishlist;
    });

    if (sortBy === 'price-ascending') {
      matchingProducts.sort((a, b) => a.variants[0].price - b.variants[0].price);
    } else if (sortBy === 'price-descending') {
      matchingProducts.sort((a, b) => b.variants[0].price - a.variants[0].price);
    }
    return matchingProducts;
  }, [catalogProducts, maxPrice, search, selectedCategory, selectedWeights, sortBy, wishlist, wishlistOnly]);

  useEffect(() => {
    if (!serverApiEnabled) return;
    let cancelled = false;
    void fetch(apiUrl('/api/products'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Product catalog request failed (${response.status}).`);
        return response.json() as Promise<ProductApiResponse>;
      })
      .then((result) => {
        if (!Array.isArray(result.items) || !result.items.every((item) => (
          item && typeof item.id === 'string' && Array.isArray(item.variants)
        ))) throw new Error('The product catalog response is invalid.');
        if (cancelled) return;
        catalogRef.current = result.items;
        setCatalogProducts(result.items);
        setCart((current) => normalizeCart(current, result.items));
        setWishlist((current) => normalizeWishlist(current, result.items));
        setCatalogError('');
      })
      .catch((error: unknown) => {
        if (!cancelled) setCatalogError(error instanceof Error
          ? `Could not load the server catalog. Showing sample products instead. ${error.message}`
          : 'Could not load the server catalog. Showing sample products instead.');
      })
      .finally(() => {
        if (!cancelled) setCatalogReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (serverApiEnabled && !catalogReady) return () => { cancelled = true; };
    if (!serverApiEnabled) {
      setCartPersistence('browser');
      setCartPersistenceMessage('Your cart is saved in this browser for this local preview.');
      return () => { cancelled = true; };
    }
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (['/login', '/register', '/forgot-password', '/account', '/profile'].includes(pathname)) {
      return () => { cancelled = true; };
    }
    void (async () => {
      try {
        const response = await requestCartApi('');
        let restoredCart = normalizeCart(response.items, catalogRef.current);
        if (response.scope === 'guest' && restoredCart.length === 0 && cartRef.current.length > 0) {
          const migrated = await requestCartApi('/merge', 'POST', { items: cartRef.current });
          restoredCart = normalizeCart(migrated.items, catalogRef.current);
        }
        if (cancelled) return;
        cartRef.current = restoredCart;
        setCart(restoredCart);
        setCartPersistence('server');
        setCartPersistenceMessage(response.scope === 'customer'
          ? 'Your cart is saved with your customer account.'
          : 'Your cart is saved in the secure server session.');
      } catch {
        if (cancelled) return;
        setCartPersistence('browser');
        setCartPersistenceMessage('Database cart unavailable. Your cart is saved only in this browser until the API and MongoDB are connected.');
      }
    })();
    return () => { cancelled = true; };
  }, [catalogReady]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem('spice-cart-items', JSON.stringify(cart));
      window.localStorage.setItem('spice-cart-wishlist', JSON.stringify(wishlist));
      window.localStorage.setItem('spice-cart-language', JSON.stringify(language));
      setStorageError('');
    } catch (error) {
      console.error('Could not save your cart preferences.', error);
      setStorageError('Your changes could not be saved in this browser.');
    }
    cartRef.current = cart;
  }, [cart, language, wishlist]);

  const updatePersistentCart = (path: string, method: string, body?: unknown) => {
    const mutation = cartMutationQueue.current.then(async () => {
      try {
        const response = await requestCartApi(path, method, body);
        const serverCart = normalizeCart(response.items);
        cartRef.current = serverCart;
        setCart(serverCart);
        setCartPersistence('server');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'The cart update failed.';
        setCartMessage(errorMessage);
        try {
          const response = await requestCartApi('');
          const serverCart = normalizeCart(response.items, catalogRef.current);
          cartRef.current = serverCart;
          setCart(serverCart);
          setCartPersistence('server');
          setCartPersistenceMessage(`Cart update failed: ${errorMessage} Your saved server cart was not changed.`);
          return;
        } catch (restoreError) {
          console.error('Could not restore the server cart after a failed update.', restoreError);
        }
        setCartPersistenceMessage(error instanceof Error
          ? `Cart database sync failed: ${error.message} Your current cart remains in this browser.`
          : 'Cart database sync failed. Your current cart remains in this browser.');
        setCartPersistence('browser');
      }
    });
    cartMutationQueue.current = mutation;
    return mutation;
  };

  const addToCart = (product: Product, requestedWeight?: string): boolean => {
    if (cartPersistence === 'checking') {
      setCartMessage('Your saved cart is still loading. Please try again in a moment.');
      return false;
    }
    const selectedWeight = product.variants.some((variant) => variant.weight === requestedWeight)
      ? requestedWeight
      : selectedWeights[product.id] ?? product.variants[1]?.weight ?? product.variants[0]?.weight;
    const selectedVariant = product.variants.find((variant) => variant.weight === selectedWeight);
    if (!selectedWeight || !selectedVariant || !catalogProducts.some((item) => item.id === product.id)
      || (!product.isDemo && (!product.orderable || selectedVariant.available === false))) {
      setCartMessage('That product pack is not available in the current catalog.');
      return false;
    }
    const currentCart = cartRef.current;
    const currentLine = currentCart.find((line) => line.productId === product.id && line.weight === selectedWeight);
    if (currentLine && currentLine.quantity >= 99) {
      setCartMessage('Maximum cart quantity reached for this pack.');
      return false;
    }
    const updatedCart = currentLine
      ? currentCart.map((line) => line.productId === product.id && line.weight === selectedWeight
        ? { ...line, quantity: line.quantity + 1 }
        : line)
      : [...currentCart, { productId: product.id, weight: selectedWeight, quantity: 1 }];
    cartRef.current = updatedCart;
    setCart(updatedCart);
    setCartMessage(`${language === 'ta' ? product.tamilName : product.name} · ${selectedWeight} ${t.added}`);
    if (cartPersistence === 'server') {
      void updatePersistentCart('/items', 'POST', { productId: product.id, weight: selectedWeight, quantity: 1 });
    }
    return true;
  };

  const updateCartQuantity = (productId: string, weight: string, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    if (cartPersistence === 'checking') return;
    const product = catalogProducts.find((item) => item.id === productId);
    if (!product?.variants.some((variant) => variant.weight === weight)) return;
    const safeQuantity = Math.min(quantity, 99);
    const updatedCart = safeQuantity < 1
      ? cartRef.current.filter((line) => !(line.productId === productId && line.weight === weight))
      : cartRef.current.map((line) => (
        line.productId === productId && line.weight === weight ? { ...line, quantity: safeQuantity } : line
      ));
    cartRef.current = updatedCart;
    setCart(updatedCart);
    if (cartPersistence === 'server') {
      if (safeQuantity === 0) {
        void updatePersistentCart('/items', 'DELETE', { productId, weight });
      } else {
        void updatePersistentCart('/items', 'PATCH', { productId, weight, quantity: safeQuantity });
      }
    }
  };

  if (window.location.pathname.replace(/\/+$/, '') === '/market-prices') {
    return <MarketPrices
      language={language}
      onLanguageToggle={() => setLanguage((current) => current === 'en' ? 'ta' : 'en')}
    />;
  }

  const routePath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (routePath === '/login' || routePath === '/register' || routePath === '/forgot-password') {
    return <AuthPages mode={routePath === '/register' ? 'register' : routePath === '/forgot-password' ? 'forgot' : 'login'} />;
  }
  if (routePath === '/account' || routePath === '/profile') {
    return <AuthPages mode={routePath === '/profile' ? 'profile' : 'account'} />;
  }
  if (routePath === '/checkout') return <CheckoutPage />;
  if (routePath.startsWith('/orders/')) {
    return <OrderStatusPage orderId={routePath.slice('/orders/'.length)} />;
  }
  if (routePath !== '/') {
    return <StorePages
      pathname={routePath}
      search={window.location.search}
      language={language}
      products={catalogProducts}
      wishlist={wishlist}
      cart={cart}
      cartPersistenceMessage={cartPersistenceMessage}
      onLanguageToggle={() => setLanguage((current) => current === 'en' ? 'ta' : 'en')}
      onAddToCart={addToCart}
      onWishlistToggle={(productId) => setWishlist((current) => current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId])}
      onCartQuantityChange={updateCartQuantity}
    />;
  }

  return (
    <div className="page-shell">
      {announcementVisible && (
        <div className="announcement-bar">
          <span>{language === 'ta' ? 'SPICE CART • முழு மசாலாக்கள் மற்றும் மசாலா கலவைகள்' : 'SPICE CART • SPICES AND MORE'}</span>
          <button aria-label="Close announcement" onClick={() => setAnnouncementVisible(false)}>×</button>
        </div>
      )}

      <header className={`topbar${topbarScrolled ? ' topbar-scrolled' : ''}`}>
        <a className="brand-wrap" href="#home" aria-label="SPICE CART home">
          <img className="brand-logo navbar-logo" src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" />
        </a>

        <nav className="nav" aria-label="Main navigation">
          <a href="/shop">{t.shop}</a>
          <a href="#categories">{t.categories}</a>
          <a href="#story">{t.story}</a>
          <a href="#customer-feedback">{t.reviews}</a>
          <a href="/market-prices">{language === 'ta' ? 'சந்தை விலை' : 'Market prices'}</a>
        </nav>

        <div className="nav-tools">
          <form className="navbar-search" action="/search">
            <label className="sr-only" htmlFor="navbar-search-input">Search spices</label>
            <input id="navbar-search-input" type="search" name="q" placeholder={t.search} />
            <button type="submit" aria-label="Search spices">⌕</button>
          </form>
          <a className="account-link" href="/login">Sign In</a>
          <button className="language-button" onClick={() => setLanguage((current) => current === 'en' ? 'ta' : 'en')}>
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>
          <a className="wishlist-nav" href="/wishlist" aria-label={`${t.wishlist}, ${wishlist.length} items`}>
            ♡ <span className="wishlist-count">{wishlist.length}</span>
          </a>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`${t.cart}, ${cartCount} items`}>
            {t.cart} <span>{cartCount}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero section" id="home">
          <div className="hero-copy">
            <img className="brand-logo hero-brand-logo" src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" />
            <p className="eyebrow">{t.heroEyebrow}</p>
            <h1>{t.heroTitle}</h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#products">{t.shopNow}</a>
              <a className="secondary-btn" href="#categories">{t.explore}</a>
            </div>
            <div className="hero-metrics">
              <div><strong>Whole spices</strong><span>Carefully selected</span></div>
              <div><strong>Bold masalas</strong><span>For everyday cooking</span></div>
              <div><strong>SPICE CART</strong><span>SPICES AND MORE</span></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="photo-card main-photo">
              <img
                src="/spice-images/spice-assortment.jpg"
                alt="A collection of assorted culinary spices"
              />
            </div>
            <div className="floating-card">
              <span className="floating-label">Blend inspiration</span>
              <strong>Garam Masala</strong>
              <p>A fragrant, warming blend made for feel-good cooking.</p>
            </div>
          </div>
        </section>

        <section className="section categories-section" id="categories">
          <div className="section-header">
            <p className="eyebrow">{t.categoryEyebrow}</p>
            <h2>{t.categoryTitle}</h2>
          </div>

          <div className="category-grid">
            {categories.map((category) => (
              <button
                key={category.name}
                className={`category-card category-filter-card${selectedCategory === category.name ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedCategory((current) => current === category.name ? '' : category.name);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                aria-pressed={selectedCategory === category.name}
              >
                <div className="category-icon">{category.icon}</div>
                <h3>{language === 'ta' ? category.tamilName : category.name}</h3>
                <p>{category.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="section products-section" id="products">
          <div className="section-header split-header">
            <div>
              <p className="eyebrow">{t.productEyebrow}</p>
              <h2>{t.productTitle}</h2>
            </div>
            <a href="#categories" className="text-link">Browse categories</a>
          </div>

          <p className="catalog-disclaimer">
            {language === 'ta'
              ? 'காட்டப்படும் கடை விலைகள் மாதிரி மதிப்புகள் மட்டுமே; ஆர்டர்கள் ஏற்கும் முன் கடை உரிமையாளர் அவற்றை உறுதிப்படுத்த வேண்டும். வெளிப்புற மொத்த அல்லது சில்லறை விலைகள் இப்பட்டியல் விலைகளாக பயன்படுத்தப்படவில்லை.'
              : 'Store prices shown are sample values and must be confirmed by the store owner before orders are accepted. External wholesale and retail prices are not used to set these listings.'}
          </p>
          <div className="catalog-controls">
            <label className="search-field">
              <span className="sr-only">{t.search}</span>
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} />
            </label>
            <label className="catalog-select">
              <span className="sr-only">{t.sort}</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="featured">{t.featured}</option>
                <option value="price-ascending">{t.priceLow}</option>
                <option value="price-descending">{t.priceHigh}</option>
              </select>
            </label>
            <label className="price-filter">
              <span>₹{maxPrice}</span>
              <input type="range" min="100" max="1500" step="50" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} aria-label="Maximum price" />
            </label>
            <button
              className={`wishlist-filter${wishlistOnly ? ' active' : ''}`}
              onClick={() => setWishlistOnly((current) => !current)}
              aria-pressed={wishlistOnly}
            >
              ♡ {t.favoritesOnly}
            </button>
            <div className="category-pills" aria-label={t.categories}>
              <button className={!selectedCategory ? 'active' : ''} onClick={() => setSelectedCategory('')}>{t.all}</button>
              {categories.map((category) => (
                <button
                  key={category.name}
                  className={selectedCategory === category.name ? 'active' : ''}
                  onClick={() => setSelectedCategory((current) => current === category.name ? '' : category.name)}
                >
                  {language === 'ta' ? category.tamilName : category.name}
                </button>
              ))}
            </div>
          </div>
          <p className="cart-message" aria-live="polite">{cartMessage || storageError || catalogError}</p>
          <div className="product-grid">
            {visibleProducts.map((product) => {
              const selectedVariant = product.variants.find((variant) => variant.weight === selectedWeights[product.id])
                ?? product.variants[1] ?? product.variants[0];
              return (
              <article key={product.id} className="product-card">
                <div className="product-image-wrap">
                  {product.image ? (
                    <img src={product.image} alt={product.imageAlt} loading="lazy" />
                  ) : (
                    <div className="photo-placeholder" role="img" aria-label={product.imageAlt}>
                      <span>Photo coming soon</span>
                      <small>Authentic product photo pending</small>
                    </div>
                  )}
                  <span className="product-badge">
                    {language === 'ta'
                      ? categories.find((category) => category.name === product.category)?.tamilName ?? product.category
                      : product.category}
                  </span>
                  <button
                    className={`product-wishlist${wishlist.includes(product.id) ? ' selected' : ''}`}
                    onClick={() => setWishlist((current) => current.includes(product.id)
                      ? current.filter((id) => id !== product.id)
                      : [...current, product.id])}
                    aria-label={`${wishlist.includes(product.id) ? 'Remove from' : 'Add to'} ${t.wishlist}: ${product.name}`}
                    aria-pressed={wishlist.includes(product.id)}
                  >
                    {wishlist.includes(product.id) ? '♥' : '♡'}
                  </button>
                </div>
                <div className="product-body">
                  <div className="meta-row">
                    <span>{t.origin}: {language === 'ta'
                      ? categories.find((category) => category.name === product.category)?.tamilName ?? product.category
                      : product.category}</span>
                  </div>
                  <h3>{language === 'ta' ? product.tamilName : product.name}</h3>
                  <a className="product-detail-link" href={`/products/${product.id}`}>View product details</a>
                  <label className="weight-picker">
                    <span>{t.chooseWeight}</span>
                    <select
                      value={selectedVariant.weight}
                      onChange={(event) => setSelectedWeights((current) => ({ ...current, [product.id]: event.target.value }))}
                      aria-label={`${t.chooseWeight}: ${product.name}`}
                    >
                      {product.variants.map((variant) => (
                        <option key={variant.weight} value={variant.weight}
                          disabled={!product.isDemo && variant.available === false}>{variant.weight}</option>
                      ))}
                    </select>
                  </label>
                  <div className="price-row">
                    <span className="price">₹{selectedVariant.price}</span>
                    {product.isDemo && <small className="store-sample-price">Sample listing</small>}
                  </div>
                  <div className="product-actions">
                    <button className="add-btn" onClick={() => addToCart(product)}
                      disabled={!product.isDemo && (!product.orderable || selectedVariant.available === false)}>{t.add}</button>
                  </div>
                </div>
              </article>
              );
            })}
            {visibleProducts.length === 0 && (
              <p className="empty-products">{t.noProducts}</p>
            )}
          </div>
        </section>

        <section className="section collections-section">
          <div className="section-header">
            <p className="eyebrow">From our shelves</p>
            <h2>Collections</h2>
          </div>

          <div className="collection-grid">
            {collections.map((item) => (
              <article key={item.title} className={`collection-card ${item.accent}`}>
                <div className="collection-content">
                  <span>{item.tag}</span>
                  <h3>{item.title}</h3>
                  <a href="/collections/premium">Explore products</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="heritage section" id="story">
          <div className="heritage-image">
            <img
              src="/spice-images/turmeric-root.jpg"
              alt="Fresh turmeric rhizome grown in Kerala, India"
            />
          </div>
          <div className="heritage-copy">
            <p className="eyebrow">About SPICE CART</p>
            <h2>A pantry shaped around flavour.</h2>
            <p>
              Explore whole spices, ground favourites, and familiar blends in one simple place.
              Product sourcing and packaging details will be added when verified for each item.
            </p>
            <ul>
              <li>Browse spices by category</li>
              <li>Choose from listed pack sizes</li>
              <li>Compare source-attributed market references when available</li>
            </ul>
          </div>
        </section>

        <section className="section trust-section">
          <div className="section-header center-header">
            <p className="eyebrow">Shopping tools</p>
            <h2>Clear about what is ready.</h2>
          </div>
          <div className="trust-grid">
            <div className="trust-item">
              <span>✦</span>
              <h3>Spice selections</h3>
              <p>Browse whole spices, ground spices, and masala blends.</p>
            </div>
            <div className="trust-item">
              <span>⚖</span>
              <h3>Pack-size options</h3>
              <p>Choose from the available size options on each product card.</p>
            </div>
            <div className="trust-item">
              <span>♡</span>
              <h3>Saved wishlist</h3>
              <p>Your wishlist is saved locally in this browser.</p>
            </div>
            <div className="trust-item">
              <span>₹</span>
              <h3>Market reference</h3>
              <p>External price observations only appear after source-attributed import.</p>
            </div>
          </div>
        </section>

        <section className="section reviews-section" id="customer-feedback">
          <div className="section-header">
            <p className="eyebrow">Customer feedback</p>
            <h2>Real reviews, when they're ready.</h2>
          </div>
          <div className="market-empty">
            We do not have verified customer reviews to publish yet. Reviews will appear here after real customers share their feedback.
          </div>
        </section>

        <section className="section journal-section">
          <div className="section-header split-header">
            <div>
              <p className="eyebrow">Recipe journal</p>
              <h2>Flavor in every story</h2>
            </div>
            <a href="/recipes" className="text-link">View recipe notes</a>
          </div>

          <p className="market-csv-help">Recipe titles are inspiration only. Verified ingredients, instructions, and recipe-to-cart links are not configured yet.</p>
          <div className="recipe-list">
            {recipes.map((recipe) => (
              <article key={recipe} className="recipe-item">
                <div className="recipe-bullet" />
                <span>{recipe}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section market-teaser">
          <div>
            <p className="eyebrow">{language === 'ta' ? 'சந்தைத் தகவல்' : 'Market reference'}</p>
            <h2>{language === 'ta' ? 'மசாலா சந்தை விலைகள்' : 'Spice market prices'}</h2>
            <p>
              {language === 'ta'
                ? 'சரிபார்க்கப்பட்ட விலைத் தரவு இணைக்கப்படவில்லை. கற்பனையான தற்போதைய விலைகளை நாங்கள் காட்டமாட்டோம்.'
                : 'Verified current market data is not connected yet. We will not display invented prices.'}
            </p>
          </div>
          <a className="secondary-btn" href="/market-prices">
            {language === 'ta' ? 'மூலங்கள் மற்றும் விலைப் பக்கத்தைப் பார்க்க' : 'View sources and market page'}
          </a>
        </section>

        <section className="section newsletter-section" id="newsletter">
          <div className="newsletter-box">
            <div>
              <p className="eyebrow">Stay in the loop</p>
              <h2>Receive curated spice notes and seasonal recipe drops.</h2>
            </div>
            <div className="newsletter-signup">
              <form
                className="newsletter-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNewsletterMessage('This demo form is not connected to a mailing list yet.');
                }}
              >
                <input type="email" placeholder="Your email address" aria-label="Email address" required />
                <button type="submit">Join us</button>
              </form>
              <p className="newsletter-message" aria-live="polite">{newsletterMessage}</p>
            </div>
          </div>
        </section>
      </main>

      {cartOpen && (
        <div className="cart-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false);
        }}>
          <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-heading">
            <div className="cart-drawer-header">
              <div>
                <p className="eyebrow">SPICE CART</p>
                <h2 id="cart-heading">{t.cartTitle} <span>({cartCount})</span></h2>
              </div>
              <button className="cart-close" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-cart">
                <span aria-hidden="true">🛒</span>
                <p>{t.emptyCart}</p>
                <button className="primary-btn" onClick={() => setCartOpen(false)}>{t.continueShopping}</button>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cart.map((line) => {
                    const product = catalogProducts.find((item) => item.id === line.productId);
                    const variant = product?.variants.find((item) => item.weight === line.weight);
                    if (!product || !variant) return null;
                    return (
                      <article className="cart-line" key={`${line.productId}-${line.weight}`}>
                        {product.image ? <img src={product.image} alt="" /> : <div className="cart-photo-placeholder" aria-hidden="true">Spice photo pending</div>}
                        <div className="cart-line-details">
                          <h3>{language === 'ta' ? product.tamilName : product.name}</h3>
                          <span>{line.weight} · ₹{variant.price}</span>
                          <div className="quantity-control">
                            <button onClick={() => updateCartQuantity(line.productId, line.weight, line.quantity - 1)} aria-label="Decrease quantity">−</button>
                            <span>{line.quantity}</span>
                            <button onClick={() => updateCartQuantity(line.productId, line.weight, line.quantity + 1)} aria-label="Increase quantity">+</button>
                            <button className="remove-line" onClick={() => updateCartQuantity(line.productId, line.weight, 0)}>{t.remove}</button>
                          </div>
                        </div>
                        <strong>₹{variant.price * line.quantity}</strong>
                      </article>
                    );
                  })}
                </div>
                <div className="cart-summary">
                  <div><span>{t.subtotal}</span><strong>₹{cartTotal}</strong></div>
                  <p>{t.checkoutUnavailable}</p>
                  <button className="primary-btn checkout-disabled" onClick={() => setCheckoutMessage(t.checkoutUnavailable)}>
                    {language === 'ta' ? 'செலுத்திச் செல்லுங்கள்' : 'Proceed to checkout'}
                  </button>
                  {checkoutMessage && <p className="checkout-message" role="status">{checkoutMessage}</p>}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <a className="brand-wrap footer-brand" href="#home" aria-label="SPICE CART home">
              <img className="brand-logo footer-logo" src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" />
            </a>
            <p>
              The good stuff for your spice rack. Find your new favourite flavour at SPICE CART.
            </p>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><a href="/shop">Our Spices</a></li>
              <li><a href="/collections/premium">Collections</a></li>
              <li><a href="/collections/combos">Gift Boxes and combos</a></li>
            </ul>
          </div>
          <div>
            <h4>About</h4>
            <ul>
              <li><a href="/about">Our Story</a></li>
              <li><a href="/recipes">Recipes</a></li>
              <li><a href="/faq">FAQs</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/market-prices">Market prices</a></li>
            </ul>
          </div>
          <div>
            <h4>Policies</h4>
            <ul>
              <li><a href="/shipping">Shipping</a></li>
              <li><a href="/returns">Returns and refunds</a></li>
              <li><a href="/privacy">Privacy</a></li>
              <li><a href="/terms">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SPICE CART</span>
          <span>
            <a href="/spice-images/credits.md">Photo credits &amp; licenses</a> · Spice reference photos are not SPICE CART packaging.
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
