import { ChangeEvent, useMemo, useState } from 'react';

type Language = 'en' | 'ta';
type PriceType = 'wholesale' | 'auction' | 'indicative';
type PriceMeasure = 'average' | 'modal' | 'reported';
type MarketObservation = {
  spice: string;
  market: string;
  state: string;
  variety: string;
  grade: string;
  priceType: PriceType;
  priceMeasure: PriceMeasure;
  minPrice: number;
  maxPrice: number;
  pricePerKg: number;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
};
type RetailObservation = {
  brand: string;
  productName: string;
  packSize: string;
  listedPrice: number;
  retailer: string;
  productUrl: string;
  observedAt: string;
  fetchedAt: string;
};

const csvHeaders = [
  'spice', 'market', 'state', 'variety', 'grade', 'priceType', 'priceMeasure',
  'minPrice', 'maxPrice', 'pricePerKg', 'sourceName', 'sourceUrl',
  'observedAt', 'fetchedAt',
];
const allowedPriceTypes: PriceType[] = ['wholesale', 'auction', 'indicative'];
const allowedPriceMeasures: PriceMeasure[] = ['average', 'modal', 'reported'];
const retailCsvHeaders = [
  'brand', 'productName', 'packSize', 'listedPrice', 'retailer', 'productUrl', 'observedAt', 'fetchedAt',
];

const labels = {
  en: {
    home: '← Back to SPICE CART', title: 'Indian spice market prices',
    subtitle: 'Reference prices from attributed sources. Wholesale, auction and retail prices are different and should not be compared as the same thing.',
    unavailableTitle: 'No verified market observations loaded',
    unavailable: 'We could not verify an authorized live price feed. This page never invents current prices. Import a source-attributed CSV to preview observations on this device.',
    freshness: 'Imported observations are unverified previews and may be stale. Last checked time comes from the CSV; no automatic synchronization is configured.',
    search: 'Search spice or market', state: 'All states', allTypes: 'All market types',
    measure: 'Price basis', average: 'Average', modal: 'Modal', reported: 'Reported value',
    wholesale: 'Wholesale', auction: 'Auction', indicative: 'Indicative',
    sort: 'Sort by price', ascending: 'Low to high', descending: 'High to low',
    importTitle: 'Preview a source-attributed CSV', import: 'Choose CSV file', template: 'Download CSV template',
    previewOnly: 'Preview only — this file stays in your browser and is not published or saved to a server.',
    noResults: 'No observations match these filters.', spice: 'Spice', market: 'Market', type: 'Price type',
    variety: 'Variety / grade', price: 'Reported ₹/kg', conversions: 'Same-grade equivalents',
    source: 'Source', observed: 'Observed', imported: 'Fetched / imported',
    retailTitle: 'Packaged retail comparisons', retailUnavailable: 'No authorized retailer feed is configured. Import a CSV for a local, unverified preview. Store prices shown on product cards remain separate.',
    officialTitle: 'Official data sources', sourceNote: 'Use these official sources or an authorized feed. Their pages may require manual access or API registration; no page scraping or live feed is assumed.',
    error: 'Could not import CSV', status: 'Preview ready', count: 'observations',
    stale: 'Stale observation', fresh: 'Recent observation', sourceUnverified: 'Source not independently verified',
    retailImport: 'Preview a retail-price CSV', retailCsvHelp: 'Headers: brand, productName, packSize, listedPrice, retailer, productUrl, observedAt, fetchedAt. Listed prices are INR per pack. MRP and stock availability are intentionally omitted because they cannot be verified here.',
    availabilityUnknown: 'Availability not verified', retailProduct: 'Product', retailPack: 'Pack',
    retailListedPrice: 'Listed price', retailer: 'Retailer', retailSource: 'Source / checked', productPage: 'Product page',
    readingCsv: 'Reading CSV…',
    csvHelp: 'CSV headers: spice, market, state, variety, grade, priceType, priceMeasure, minPrice, maxPrice, pricePerKg, sourceName, sourceUrl, observedAt, fetchedAt. Use ISO dates; price type must be wholesale, auction, or indicative.',
    tooLarge: 'CSV must be under 2 MB and contain no more than 5,000 rows.',
    retailError: 'Could not import retail CSV',
  },
  ta: {
    home: '← SPICE CART முகப்புக்குத் திரும்பு', title: 'இந்திய மசாலா சந்தை விலைகள்',
    subtitle: 'மூலத்துடன் குறிப்பிடப்பட்ட சந்தைத் தகவல்கள். மொத்த, ஏல மற்றும் சில்லறை விலைகள் வெவ்வேறு வகைகள்; அவற்றை ஒரே அளவாக ஒப்பிட வேண்டாம்.',
    unavailableTitle: 'சரிபார்க்கப்பட்ட சந்தை விலைத் தகவல் இல்லை',
    unavailable: 'அனுமதிக்கப்பட்ட நேரடி விலைத் தரவை இப்போது சரிபார்க்க முடியவில்லை. தற்போதைய விலைகளை நாங்கள் உருவாக்கிக் காட்டமாட்டோம். மூலத் தகவலுடன் CSV-ஐ பதிவேற்றி இந்த சாதனத்தில் முன்னோட்டம் பார்க்கலாம்.',
    freshness: 'பதிவேற்றிய தரவு சரிபார்க்கப்படாத முன்னோட்டம்; பழையதாக இருக்கலாம். தானியங்கி ஒத்திசைவு அமைக்கப்படவில்லை.',
    search: 'மசாலா அல்லது சந்தையைத் தேடுங்கள்', state: 'அனைத்து மாநிலங்கள்', allTypes: 'அனைத்து விலை வகைகள்',
    measure: 'விலை அளவீடு', average: 'சராசரி', modal: 'அடிக்கடி வரும் விலை', reported: 'அறிவிக்கப்பட்ட விலை',
    wholesale: 'மொத்த விலை', auction: 'ஏல விலை', indicative: 'குறிப்பீட்டு விலை',
    sort: 'விலையின்படி வரிசை', ascending: 'குறைவிலிருந்து அதிகம்', descending: 'அதிகத்திலிருந்து குறைவு',
    importTitle: 'மூலத் தகவலுள்ள CSV முன்னோட்டம்', import: 'CSV கோப்பைத் தேர்ந்தெடு', template: 'CSV மாதிரியைப் பதிவிறக்கு',
    previewOnly: 'முன்னோட்டம் மட்டும் — கோப்பு உங்கள் உலாவியிலேயே இருக்கும்; வெளியிடவோ சேவையகத்தில் சேமிக்கவோ மாட்டோம்.',
    noResults: 'இந்த வடிகட்டிகளுக்குப் பொருத்தமான விலைத் தகவல் இல்லை.', spice: 'மசாலா', market: 'சந்தை', type: 'விலை வகை',
    variety: 'வகை / தரம்', price: 'அறிவிக்கப்பட்ட ₹/கிலோ', conversions: 'அதே தரத்திற்கான மாற்று விலைகள்',
    source: 'மூலம்', observed: 'பதிவு நேரம்', imported: 'பெறப்பட்டது / இறக்குமதி',
    retailTitle: 'பொதி செய்யப்பட்ட சில்லறை ஒப்பீடுகள்', retailUnavailable: 'அங்கீகரிக்கப்பட்ட சில்லறை விலை feed அமைக்கப்படவில்லை. உலாவியில் மட்டும் CSV முன்னோட்டத்தைப் பதிவேற்றலாம். கடை விலைகள் தனியாகவே காட்டப்படும்.',
    officialTitle: 'அதிகாரப்பூர்வ தரவு மூலங்கள்', sourceNote: 'அதிகாரப்பூர்வ மூலங்கள் அல்லது அங்கீகரிக்கப்பட்ட feed-ஐப் பயன்படுத்தவும். API அணுகல் தேவைப்படலாம்; நேரடி feed இருப்பதாகக் கருதவில்லை.',
    error: 'CSV இறக்குமதி தோல்வியடைந்தது', status: 'முன்னோட்டம் தயார்', count: 'விலைப் பதிவுகள்',
    stale: 'பழைய பதிவு', fresh: 'சமீபத்திய பதிவு', sourceUnverified: 'மூலம் தனியாக சரிபார்க்கப்படவில்லை',
    retailImport: 'சில்லறை விலை CSV முன்னோட்டம்', retailCsvHelp: 'தலைப்புகள்: brand, productName, packSize, listedPrice, retailer, productUrl, observedAt, fetchedAt. விலை ஒரு பொதிக்கான INR. இங்கு சரிபார்க்க முடியாததால் MRP மற்றும் இருப்பு காட்டப்படாது.',
    availabilityUnknown: 'இருப்பு சரிபார்க்கப்படவில்லை', retailProduct: 'பொருள்', retailPack: 'பொதி',
    retailListedPrice: 'குறிப்பிட்ட விலை', retailer: 'விற்பனையாளர்', retailSource: 'மூலம் / சரிபார்ப்பு', productPage: 'பொருள் பக்கம்',
    readingCsv: 'CSV படிக்கப்படுகிறது…',
    csvHelp: 'CSV தலைப்புகள்: spice, market, state, variety, grade, priceType, priceMeasure, minPrice, maxPrice, pricePerKg, sourceName, sourceUrl, observedAt, fetchedAt. ISO தேதி; wholesale, auction அல்லது indicative விலை வகையைப் பயன்படுத்தவும்.',
    tooLarge: 'CSV 2 MB-க்குள் இருக்க வேண்டும்; அதிகபட்சம் 5,000 வரிகள்.',
    retailError: 'சில்லறை CSV இறக்குமதி தோல்வியடைந்தது',
  },
} satisfies Record<Language, Record<string, string>>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(value.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

function parseObservations(text: string): MarketObservation[] {
  const rows = parseCsv(text);
  const header = rows.shift()?.map((cell) => cell.toLowerCase());
  if (!header || csvHeaders.some((column) => !header.includes(column.toLowerCase()))) {
    throw new Error(`CSV must include these columns: ${csvHeaders.join(', ')}.`);
  }
  if (rows.length === 0) throw new Error('CSV must contain at least one observation row.');
  if (rows.length > 5000) throw new Error('CSV contains more than 5,000 data rows.');
  return rows.map((cells, rowIndex) => {
    const cell = (name: string) => cells[header.indexOf(name.toLowerCase())]?.trim() ?? '';
    const rowLabel = `CSV row ${rowIndex + 2}`;
    const priceType = cell('priceType').toLowerCase() as PriceType;
    if (!allowedPriceTypes.includes(priceType)) throw new Error(`${rowLabel}: priceType must be wholesale, auction, or indicative.`);
    const priceMeasure = cell('priceMeasure').toLowerCase() as PriceMeasure;
    if (!allowedPriceMeasures.includes(priceMeasure)) throw new Error(`${rowLabel}: priceMeasure must be average, modal, or reported.`);
    const numeric = (name: string, required: boolean) => {
      const raw = cell(name);
      if (!raw && !required) return 0;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || (required && value === 0)) {
        throw new Error(`${rowLabel}: ${name} must be a valid positive number.`);
      }
      return value;
    };
    const minPrice = numeric('minPrice', false);
    const maxPrice = numeric('maxPrice', false);
    const pricePerKg = numeric('pricePerKg', true);
    if (minPrice > 0 && maxPrice > 0 && minPrice > maxPrice) {
      throw new Error(`${rowLabel}: minPrice cannot be greater than maxPrice.`);
    }
    if (!cell('spice') || !cell('market') || !cell('state') || !cell('sourceName')) {
      throw new Error(`${rowLabel}: spice, market, state, and sourceName are required.`);
    }
    let source: URL;
    try {
      source = new URL(cell('sourceUrl'));
    } catch {
      throw new Error(`${rowLabel}: sourceUrl must be a valid http(s) URL.`);
    }
    if (source.protocol !== 'http:' && source.protocol !== 'https:') {
      throw new Error(`${rowLabel}: sourceUrl must use http or https.`);
    }
    const observedAt = new Date(cell('observedAt'));
    const fetchedAt = new Date(cell('fetchedAt'));
    if (!cell('observedAt') || Number.isNaN(observedAt.getTime()) || !cell('fetchedAt') || Number.isNaN(fetchedAt.getTime())) {
      throw new Error(`${rowLabel}: observedAt and fetchedAt must be valid ISO dates.`);
    }
    if (observedAt.getTime() > Date.now() || fetchedAt.getTime() > Date.now() || fetchedAt < observedAt) {
      throw new Error(`${rowLabel}: dates cannot be in the future, and fetchedAt cannot be earlier than observedAt.`);
    }
    if (minPrice > 0 && maxPrice > 0 && (pricePerKg < minPrice || pricePerKg > maxPrice)) {
      throw new Error(`${rowLabel}: pricePerKg must be within the reported minimum and maximum.`);
    }
    return {
      spice: cell('spice'), market: cell('market'), state: cell('state'),
      variety: cell('variety'), grade: cell('grade'), priceType, priceMeasure,
      minPrice, maxPrice, pricePerKg, sourceName: cell('sourceName'),
      sourceUrl: source.toString(), observedAt: observedAt.toISOString(), fetchedAt: fetchedAt.toISOString(),
    };
  });
}

function parseRetailObservations(text: string): RetailObservation[] {
  const rows = parseCsv(text);
  const header = rows.shift()?.map((cell) => cell.toLowerCase());
  if (!header || retailCsvHeaders.some((column) => !header.includes(column.toLowerCase()))) {
    throw new Error(`CSV must include these columns: ${retailCsvHeaders.join(', ')}.`);
  }
  if (rows.length === 0) throw new Error('CSV must contain at least one retail observation row.');
  if (rows.length > 5000) throw new Error('CSV contains more than 5,000 data rows.');
  return rows.map((cells, rowIndex) => {
    const cell = (name: string) => cells[header.indexOf(name.toLowerCase())]?.trim() ?? '';
    const rowLabel = `CSV row ${rowIndex + 2}`;
    const listedPrice = Number(cell('listedPrice'));
    if (!Number.isFinite(listedPrice) || listedPrice <= 0) {
      throw new Error(`${rowLabel}: listedPrice must be a positive number.`);
    }
    if (!cell('brand') || !cell('productName') || !cell('packSize') || !cell('retailer')) {
      throw new Error(`${rowLabel}: brand, productName, packSize, and retailer are required.`);
    }
    let productUrl: URL;
    try {
      productUrl = new URL(cell('productUrl'));
    } catch {
      throw new Error(`${rowLabel}: productUrl must be a valid http(s) URL.`);
    }
    if (productUrl.protocol !== 'http:' && productUrl.protocol !== 'https:') {
      throw new Error(`${rowLabel}: productUrl must use http or https.`);
    }
    const observedAt = new Date(cell('observedAt'));
    const fetchedAt = new Date(cell('fetchedAt'));
    if (!cell('observedAt') || Number.isNaN(observedAt.getTime()) || !cell('fetchedAt') || Number.isNaN(fetchedAt.getTime())) {
      throw new Error(`${rowLabel}: observedAt and fetchedAt must be valid ISO dates.`);
    }
    if (observedAt.getTime() > Date.now() || fetchedAt.getTime() > Date.now() || fetchedAt < observedAt) {
      throw new Error(`${rowLabel}: dates cannot be in the future, and fetchedAt cannot be earlier than observedAt.`);
    }
    return {
      brand: cell('brand'), productName: cell('productName'), packSize: cell('packSize'),
      listedPrice, retailer: cell('retailer'), productUrl: productUrl.toString(),
      observedAt: observedAt.toISOString(), fetchedAt: fetchedAt.toISOString(),
    };
  });
}

function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ta' ? 'ta-IN' : 'en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

type MarketPricesProps = { language: Language; onLanguageToggle: () => void };

export default function MarketPrices({ language, onLanguageToggle }: MarketPricesProps) {
  const t = labels[language];
  const [observations, setObservations] = useState<MarketObservation[]>([]);
  const [retailObservations, setRetailObservations] = useState<RetailObservation[]>([]);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retailError, setRetailError] = useState('');
  const [retailNotice, setRetailNotice] = useState('');
  const [retailBusy, setRetailBusy] = useState(false);

  const states = useMemo(() => [...new Set(observations.map((item) => item.state))].sort(), [observations]);
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return observations
      .filter((item) => (!normalized || `${item.spice} ${item.market} ${item.state}`.toLocaleLowerCase().includes(normalized))
        && (!stateFilter || item.state === stateFilter)
        && (!typeFilter || item.priceType === typeFilter))
      .sort((a, b) => sortDirection === 'ascending' ? a.pricePerKg - b.pricePerKg : b.pricePerKg - a.pricePerKg);
  }, [observations, query, stateFilter, typeFilter, sortDirection]);

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(t.tooLarge);
      setNotice('');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const imported = parseObservations(await file.text());
      setObservations(imported);
      setNotice(`${t.status}: ${imported.length} ${t.count}. ${t.sourceUnverified}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  const importRetailCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setRetailError(t.tooLarge);
      setRetailNotice('');
      return;
    }
    setRetailBusy(true);
    setRetailError('');
    setRetailNotice('');
    try {
      const imported = parseRetailObservations(await file.text());
      setRetailObservations(imported);
      setRetailNotice(`${t.status}: ${imported.length} ${t.count}. ${t.sourceUnverified}`);
    } catch (importError) {
      setRetailError(importError instanceof Error ? importError.message : t.retailError);
    } finally {
      setRetailBusy(false);
    }
  };

  return (
    <main className="market-page">
      <header className="market-header">
        <div className="market-top-controls">
          <a className="market-back" href="/">{t.home}</a>
          <button className="language-button" onClick={onLanguageToggle}>
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>
        </div>
        <p className="eyebrow">SPICE CART · REFERENCE DATA</p>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>

      <section className="market-state" aria-live="polite">
        <strong>{observations.length ? `${t.status}: ${observations.length} ${t.count}` : t.unavailableTitle}</strong>
        <p>{observations.length ? t.freshness : t.unavailable}</p>
        <small>{t.freshness}</small>
      </section>

      <section className="market-import">
        <div>
          <p className="eyebrow">{t.importTitle}</p>
          <p className="market-csv-help">{t.csvHelp}</p>
          <p className="market-preview-notice">{t.previewOnly}</p>
        </div>
        <div className="market-import-actions">
          <label className="market-upload">
            {busy ? 'Reading CSV…' : t.import}
            <input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy} />
          </label>
          <a className="secondary-btn" href="/market-prices-template.csv" download>{t.template}</a>
        </div>
        {error && <p className="market-error" role="alert">{t.error}: {error}</p>}
        {notice && <p className="market-notice" role="status">{notice}</p>}
      </section>

      <section className="market-table-section">
        <div className="market-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label={t.state}>
            <option value="">{t.state}</option>
            {states.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label={t.allTypes}>
            <option value="">{t.allTypes}</option>
            {allowedPriceTypes.map((type) => <option key={type} value={type}>{t[type]}</option>)}
          </select>
          <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'ascending' | 'descending')} aria-label={t.sort}>
            <option value="ascending">{t.ascending}</option>
            <option value="descending">{t.descending}</option>
          </select>
        </div>
        {visibleRows.length === 0 ? (
          <div className="market-empty">{observations.length ? t.noResults : t.unavailable}</div>
        ) : (
          <div className="market-table-scroll">
            <table className="market-table">
              <thead>
                <tr>
                  <th>{t.spice}</th><th>{t.market}</th><th>{t.type}</th><th>{t.measure}</th><th>{t.variety}</th>
                  <th>{t.price}</th><th>{t.conversions}</th><th>{t.source}</th><th>{t.observed}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const stale = Date.now() - new Date(row.observedAt).getTime() > 72 * 60 * 60 * 1000
                    || Date.now() - new Date(row.fetchedAt).getTime() > 72 * 60 * 60 * 1000;
                  return (
                    <tr key={`${row.spice}-${row.market}-${row.observedAt}-${index}`}>
                      <td data-label={t.spice}><strong>{row.spice}</strong></td>
                      <td data-label={t.market}>{row.market}, {row.state}</td>
                      <td data-label={t.type}><span className="market-type">{t[row.priceType]}</span></td>
                      <td data-label={t.measure}>{t[row.priceMeasure]}</td>
                      <td data-label={t.variety}>{[row.variety, row.grade].filter(Boolean).join(' · ') || '—'}</td>
                      <td data-label={t.price}>
                        <strong>₹{row.pricePerKg.toLocaleString('en-IN')}</strong>/kg
                        {row.minPrice > 0 && row.maxPrice > 0 && (
                          <small>₹{row.minPrice.toLocaleString('en-IN')} – ₹{row.maxPrice.toLocaleString('en-IN')}</small>
                        )}
                        {row.minPrice > 0 && row.maxPrice === 0 && (
                          <small>Min ₹{row.minPrice.toLocaleString('en-IN')}</small>
                        )}
                        {row.maxPrice > 0 && row.minPrice === 0 && (
                          <small>Max ₹{row.maxPrice.toLocaleString('en-IN')}</small>
                        )}
                      </td>
                      <td data-label={t.conversions}>
                        ₹{(row.pricePerKg / 10).toFixed(2)} / 100 g<br />
                        ₹{(row.pricePerKg / 4).toFixed(2)} / 250 g<br />
                        ₹{(row.pricePerKg / 2).toFixed(2)} / 500 g
                      </td>
                      <td data-label={t.source}>
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName}</a>
                        <small>{t.sourceUnverified}</small>
                      </td>
                      <td data-label={t.observed}>
                        {formatDate(row.observedAt, language)}
                        <small className={stale ? 'stale-label' : 'fresh-label'}>{stale ? t.stale : t.fresh}</small>
                        <small>{t.imported}: {formatDate(row.fetchedAt, language)}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="retail-reference">
        <p className="eyebrow">{t.retailTitle}</p>
        <p>{retailObservations.length ? t.previewOnly : t.retailUnavailable}</p>
        <div className="market-import-actions retail-import-actions">
          <label className="market-upload">
            {retailBusy ? t.readingCsv : t.retailImport}
            <input type="file" accept=".csv,text/csv" onChange={importRetailCsv} disabled={retailBusy} />
          </label>
          <a className="secondary-btn" href="/retail-prices-template.csv" download>{t.template}</a>
        </div>
        <p className="market-csv-help">{t.retailCsvHelp}</p>
        {retailError && <p className="market-error" role="alert">{t.retailError}: {retailError}</p>}
        {retailNotice && <p className="market-notice" role="status">{retailNotice}</p>}
        {retailObservations.length > 0 && (
          <div className="market-table-scroll">
            <table className="market-table retail-table">
              <thead>
                <tr>
                  <th>{t.retailProduct}</th><th>{t.retailPack}</th><th>{t.retailListedPrice}</th><th>{t.retailer}</th>
                  <th>{t.availabilityUnknown}</th><th>{t.retailSource}</th>
                </tr>
              </thead>
              <tbody>
                {retailObservations.map((row, index) => {
                  const stale = Date.now() - new Date(row.observedAt).getTime() > 24 * 60 * 60 * 1000
                    || Date.now() - new Date(row.fetchedAt).getTime() > 24 * 60 * 60 * 1000;
                  return (
                    <tr key={`${row.productName}-${row.retailer}-${row.observedAt}-${index}`}>
                      <td data-label={t.retailProduct}><strong>{row.brand} {row.productName}</strong></td>
                      <td data-label={t.retailPack}>{row.packSize}</td>
                      <td data-label={t.retailListedPrice}><strong>₹{row.listedPrice.toLocaleString('en-IN')}</strong> / pack</td>
                      <td data-label={t.retailer}>{row.retailer}</td>
                      <td data-label={t.availabilityUnknown}>{t.availabilityUnknown}</td>
                      <td data-label={t.retailSource}>
                        <a href={row.productUrl} target="_blank" rel="noreferrer">{t.productPage}</a>
                        <small className={stale ? 'stale-label' : 'fresh-label'}>
                          {stale ? t.stale : t.fresh}: {formatDate(row.observedAt, language)}
                        </small>
                        <small>{t.sourceUnverified}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="official-sources">
        <p className="eyebrow">{t.officialTitle}</p>
        <p>{t.sourceNote}</p>
        <ul>
          <li><a href="https://www.indianspices.com/marketing/price/domestic/current-market-price.html" target="_blank" rel="noreferrer">Spices Board of India — Domestic current market price</a></li>
          <li><a href="https://www.indianspices.com/marketing/price/domestic/daily-price" target="_blank" rel="noreferrer">Spices Board of India — Daily auction prices</a></li>
          <li><a href="https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi" target="_blank" rel="noreferrer">Government of India — AGMARKNET daily mandi prices</a></li>
        </ul>
      </section>
      <footer className="market-footer"><a href="/">SPICE CART · SPICES AND MORE</a> · Market data is for reference only, not a guaranteed supplier quote.</footer>
    </main>
  );
}
