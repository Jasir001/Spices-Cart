import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { apiUrl, serverApiEnabled } from './api';

type AuthPageProps = { mode: 'login' | 'register' | 'forgot' | 'account' | 'profile' };
type FormErrors = Record<string, string>;
type Customer = { id: string; fullName: string; email: string; mobile: string; emailVerified: boolean };

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/account';
  return value;
}

function emailError(value: string): string {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return '';
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(apiUrl('/api/auth/csrf'), { credentials: 'include' });
  const result = await response.json() as { csrfToken?: string; error?: string };
  if (!response.ok || !result.csrfToken) throw new Error(result.error ?? 'Could not start a secure session.');
  return result.csrfToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
  const result = response.status === 204
    ? undefined
    : await response.json() as T & { error?: string; fields?: { field: string; message: string }[] };
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('The authentication service is temporarily unavailable. Check the server and database setup, then try again.');
    }
    const error = new Error(result?.error ?? 'The request could not be completed.') as Error & { fields?: { field: string; message: string }[] };
    error.fields = result?.fields;
    throw error;
  }
  return result as T;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-brand-panel" aria-label="SPICE CART brand">
        <a className="auth-back-link" href="/">← Back to Store</a>
        <a className="auth-brand-logo" href="/" aria-label="SPICE CART home">
          <img src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" />
        </a>
        <div className="auth-brand-copy">
          <p className="eyebrow">SPICES AND MORE</p>
          <h1>A warmer welcome to your spice shelf.</h1>
          <p>Discover whole spices, fragrant powders, and blends for everyday cooking.</p>
        </div>
        <div className="auth-spice-photo">
          <img src="/spice-images/spice-assortment.jpg" alt="An assortment of culinary spices" />
        </div>
      </section>
      <section className="auth-form-panel">
        {children}
        <footer className="auth-legal-links">
          <a href="/privacy">Privacy Policy</a><span aria-hidden="true">·</span><a href="/terms">Terms and Conditions</a>
        </footer>
      </section>
    </main>
  );
}

function AuthNotice({ children }: { children: ReactNode }) {
  return <div className="auth-service-notice" role="alert"><span>{children}</span></div>;
}

export default function AuthPages({ mode }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accountLoading, setAccountLoading] = useState(mode === 'account' || mode === 'profile');
  const [csrfToken, setCsrfToken] = useState('');
  const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
  const accountLink = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    let cancelled = false;
    if (!serverApiEnabled) {
      if (mode === 'account' || mode === 'profile') {
        setFormMessage('Customer accounts are unavailable in this local browser-only preview.');
        setAccountLoading(false);
      } else if (mode === 'login' || mode === 'register') {
        setFormMessage('Customer authentication is disabled in this local preview. Set VITE_API_ENABLED=true and start the API to enable it.');
      }
      return () => { cancelled = true; };
    }
    if (mode === 'account' || mode === 'profile') {
      void apiRequest<{ user: Customer }>('/api/auth/me')
        .then(({ user }) => { if (!cancelled) setCustomer(user); })
        .catch((error: unknown) => {
          if (!cancelled && !(error instanceof Error && error.message.includes('sign in'))) {
            setFormMessage(error instanceof Error ? error.message : 'Could not load your account.');
          }
        })
        .finally(() => { if (!cancelled) setAccountLoading(false); });
    } else if (mode === 'login' || mode === 'register') {
      void getCsrfToken()
        .then(async (token) => {
          if (cancelled) return;
          setCsrfToken(token);
          const response = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
          if (response.ok) window.location.replace(returnTo);
        })
        .catch(() => {
          if (!cancelled) setFormMessage('Authentication service is unavailable. Start the API and configure its database to continue.');
        });
    }
    return () => { cancelled = true; };
  }, [mode, returnTo]);

  const validateLogin = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const emailMessage = emailError(email);
    if (emailMessage) nextErrors.email = emailMessage;
    if (!password) nextErrors.password = 'Enter your password.';
    return nextErrors;
  };

  const validateRegistration = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
    const emailMessage = emailError(email);
    if (emailMessage) nextErrors.email = emailMessage;
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\s+/g, ''))) {
      nextErrors.mobile = 'Enter a valid 10-digit Indian mobile number.';
    }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      nextErrors.password = 'Use at least 8 characters with uppercase, lowercase, and a number.';
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
    if (!acceptedPolicies) nextErrors.policies = 'Accept the Privacy Policy and Terms to continue.';
    return nextErrors;
  };

  const submitAuthForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = mode === 'login' ? validateLogin() : validateRegistration();
    setErrors(nextErrors);
    setFormMessage('');
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const token = csrfToken || await getCsrfToken();
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { fullName, email, mobile: mobile.replace(/\s+/g, ''), password, confirmPassword };
      const result = await apiRequest<{ user: Customer; csrfToken: string }>(endpoint, {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      setCsrfToken(result.csrfToken);
      setPassword('');
      setConfirmPassword('');
      setFormMessage(mode === 'login' ? 'Signed in successfully.' : 'Your account was created successfully.');
      window.setTimeout(() => window.location.replace(returnTo), 500);
    } catch (error) {
      if (error instanceof Error && 'fields' in error) {
        const fields = (error as Error & { fields?: { field: string; message: string }[] }).fields ?? [];
        setErrors(Object.fromEntries(fields.map((field) => [field.field, field.message])));
      } else {
        setFormMessage(error instanceof Error ? error.message : 'The request could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer || submitting) return;
    const nextErrors: FormErrors = {};
    if (customer.fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
    if (!/^[6-9]\d{9}$/.test(customer.mobile)) nextErrors.mobile = 'Enter a valid 10-digit Indian mobile number.';
    setErrors(nextErrors);
    setFormMessage('');
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const token = await getCsrfToken();
      const result = await apiRequest<{ user: Customer }>('/api/auth/me', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': token },
        body: JSON.stringify({ fullName: customer.fullName, mobile: customer.mobile }),
      });
      setCustomer(result.user);
      setFormMessage('Your profile has been updated.');
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Could not update your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setFormMessage('');
    try {
      const token = await getCsrfToken();
      await apiRequest<void>('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': token } });
      window.location.replace('/');
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  const title = mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Your Account' : 'Forgot Password?';

  if (mode === 'account' || mode === 'profile') {
    return (
      <AuthLayout>
        <section className="auth-card" aria-labelledby="auth-heading">
          <p className="eyebrow">SPICE CART · CUSTOMER ACCOUNT</p>
          <h2 id="auth-heading">{mode === 'profile' ? 'Your Profile' : 'Your Account'}</h2>
          {accountLoading ? <p role="status">Loading your account…</p> : customer ? (
            <form className="auth-form" onSubmit={(event) => void updateProfile(event)}>
              <label className="auth-field" htmlFor="account-full-name">Full name
                <input id="account-full-name" value={customer.fullName} onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} aria-invalid={Boolean(errors.fullName)} />
                {errors.fullName && <span className="auth-field-error">{errors.fullName}</span>}
              </label>
              <label className="auth-field" htmlFor="account-email">Email address
                <input id="account-email" type="email" value={customer.email} readOnly />
              </label>
              <label className="auth-field" htmlFor="account-mobile">Mobile number
                <input id="account-mobile" type="tel" inputMode="numeric" value={customer.mobile} onChange={(event) => setCustomer({ ...customer, mobile: event.target.value.replace(/\s+/g, '') })} aria-invalid={Boolean(errors.mobile)} />
                {errors.mobile && <span className="auth-field-error">{errors.mobile}</span>}
              </label>
              <p className="auth-field-hint">{customer.emailVerified ? 'Email verified' : 'Email verification has not been configured.'}</p>
              {formMessage && <AuthNotice>{formMessage}</AuthNotice>}
              <button className="primary-btn auth-submit" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save profile'}</button>
              <button className="secondary-btn auth-submit" type="button" onClick={() => void logout()}>Sign Out</button>
            </form>
          ) : (
            <div className="auth-form">
              <p>{formMessage || 'Please sign in to view your account.'}</p>
              <div className="store-page-actions">
                <a className="primary-btn" href={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>Sign In</a>
                <a className="secondary-btn" href={`/register?returnTo=${encodeURIComponent(window.location.pathname)}`}>Create Account</a>
              </div>
            </div>
          )}
        </section>
        {mode === 'account' && customer && (
          <nav className="account-page-nav" aria-label="Your account">
            <a href="/profile">Profile</a><a href="/orders">Order history</a><a href="/tracking">Order tracking</a>
          </nav>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="auth-heading">
        <p className="eyebrow">SPICE CART · SPICES AND MORE</p>
        <h2 id="auth-heading">{title}</h2>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to discover the true taste of India.'
            : mode === 'register'
              ? 'Create your SPICE CART account.'
              : 'Password reset is not available until email authentication is configured.'}
        </p>

        {mode === 'forgot' ? (
          <form className="auth-form" onSubmit={(event) => {
            event.preventDefault();
            const emailMessage = emailError(email);
            setErrors(emailMessage ? { email: emailMessage } : {});
            setFormMessage(emailMessage ? '' : 'Password reset email is not configured. No email was sent.');
          }} noValidate>
            <label className="auth-field" htmlFor="forgot-email">Email address
              <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'forgot-email-error' : undefined} />
              {errors.email && <span className="auth-field-error" id="forgot-email-error">{errors.email}</span>}
            </label>
            <button className="primary-btn auth-submit" type="submit">Request password reset</button>
            {formMessage && <AuthNotice>{formMessage}</AuthNotice>}
            <a className="auth-secondary-link" href={accountLink}>Back to sign in</a>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submitAuthForm(event)} noValidate>
            {mode === 'register' && (
              <label className="auth-field" htmlFor="auth-full-name">Full name
                <input id="auth-full-name" type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'auth-full-name-error' : undefined} />
                {errors.fullName && <span className="auth-field-error" id="auth-full-name-error">{errors.fullName}</span>}
              </label>
            )}
            <label className="auth-field" htmlFor="auth-email">Email address
              <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'auth-email-error' : undefined} />
              {errors.email && <span className="auth-field-error" id="auth-email-error">{errors.email}</span>}
            </label>
            {mode === 'register' && (
              <label className="auth-field" htmlFor="auth-mobile">Mobile number <span className="auth-field-hint">+91</span>
                <input id="auth-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={12} value={mobile} onChange={(event) => setMobile(event.target.value)} aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? 'auth-mobile-error' : undefined} />
                {errors.mobile && <span className="auth-field-error" id="auth-mobile-error">{errors.mobile}</span>}
              </label>
            )}
            <label className="auth-field" htmlFor="auth-password">Password
              <span className="auth-password-wrap">
                <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'auth-password-error' : mode === 'register' ? 'auth-password-hint' : undefined} />
                <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
              </span>
              {errors.password && <span className="auth-field-error" id="auth-password-error">{errors.password}</span>}
              {mode === 'register' && <span className="auth-field-hint" id="auth-password-hint">At least 8 characters, including uppercase, lowercase, and a number.</span>}
            </label>
            {mode === 'login' && <div className="auth-form-options"><a href="/forgot-password">Forgot password?</a></div>}
            {mode === 'register' && (
              <label className="auth-field" htmlFor="auth-confirm-password">Confirm password
                <span className="auth-password-wrap">
                  <input id="auth-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'auth-confirm-password-error' : undefined} />
                  <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
                </span>
                {errors.confirmPassword && <span className="auth-field-error" id="auth-confirm-password-error">{errors.confirmPassword}</span>}
              </label>
            )}
            {mode === 'register' && (
              <>
                <label className="auth-checkbox">
                  <input type="checkbox" checked={acceptedPolicies} onChange={(event) => setAcceptedPolicies(event.target.checked)} aria-invalid={Boolean(errors.policies)} aria-describedby={errors.policies ? 'auth-policies-error' : undefined} />
                  <span>I agree to the <a href="/terms">Terms and Conditions</a> and <a href="/privacy">Privacy Policy</a>.</span>
                </label>
                {errors.policies && <span className="auth-field-error" id="auth-policies-error">{errors.policies}</span>}
              </>
            )}
            <button className="primary-btn auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            {formMessage && (formMessage.includes('successfully')
              ? <p className="auth-success-message" role="status">{formMessage}</p>
              : <AuthNotice>{formMessage}</AuthNotice>)}
            <p className="auth-switch-link">
              {mode === 'login' ? (
                <>New to Spice Cart? <a href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an Account</a></>
              ) : (
                <>Already have an account? <a href={accountLink}>Sign in</a></>
              )}
            </p>
          </form>
        )}
      </section>
    </AuthLayout>
  );
}
