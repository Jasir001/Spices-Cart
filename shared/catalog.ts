export type Product = {
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

export const products: Product[] = [
  {
    id: 'ceylon-cinnamon',
    name: 'Ceylon Cinnamon',
    tamilName: 'சிலோன் இலவங்கப்பட்டை',
    category: 'Whole Spices',
    image: '/spice-images/cinnamon.jpg',
    imageAlt: 'Ceylon cinnamon sticks with cinnamon powder',
    variants: [{ weight: '50 g', price: 299 }, { weight: '100 g', price: 499 }, { weight: '250 g', price: 1099 }],
  },
  {
    id: 'black-pepper',
    name: 'Whole Black Pepper',
    tamilName: 'முழு கருமிளகு',
    category: 'Whole Spices',
    image: '/spice-images/black-pepper.jpg',
    imageAlt: 'Whole black peppercorns',
    variants: [{ weight: '50 g', price: 229 }, { weight: '100 g', price: 399 }, { weight: '250 g', price: 899 }],
  },
  {
    id: 'green-cardamom',
    name: 'Green Cardamom',
    tamilName: 'பச்சை ஏலக்காய்',
    category: 'Whole Spices',
    image: '/spice-images/green-cardamom.jpg',
    imageAlt: 'Green cardamom pods',
    variants: [{ weight: '25 g', price: 369 }, { weight: '50 g', price: 689 }, { weight: '100 g', price: 1299 }],
  },
  {
    id: 'turmeric',
    name: 'Turmeric Powder',
    tamilName: 'மஞ்சள் தூள்',
    category: 'Ground Spices',
    image: '/spice-images/turmeric-spices.jpg',
    imageAlt: 'Turmeric, coriander and cumin powders',
    variants: [{ weight: '100 g', price: 169 }, { weight: '200 g', price: 299 }, { weight: '500 g', price: 649 }],
  },
  {
    id: 'cloves',
    name: 'Whole Cloves',
    tamilName: 'கிராம்பு',
    category: 'Whole Spices',
    image: '/spice-images/cloves.jpg',
    imageAlt: 'Whole dried clove buds',
    variants: [{ weight: '50 g', price: 199 }, { weight: '100 g', price: 349 }, { weight: '250 g', price: 799 }],
  },
  {
    id: 'chilli-powder',
    name: 'Kashmiri Chilli Powder',
    tamilName: 'காஷ்மீரி மிளகாய்த் தூள்',
    category: 'Ground Spices',
    image: '/spice-images/spice-assortment.jpg',
    imageAlt: 'Assorted whole spices and powders; representative ingredient photo, not retail packaging',
    variants: [{ weight: '100 g', price: 199 }, { weight: '200 g', price: 349 }, { weight: '500 g', price: 799 }],
  },
  {
    id: 'garam-masala',
    name: 'Garam Masala',
    tamilName: 'கரம் மசாலா',
    category: 'Signature Masalas',
    image: '/spice-images/garam-masala.jpg',
    imageAlt: 'Garam masala powder',
    variants: [{ weight: '100 g', price: 249 }, { weight: '200 g', price: 449 }, { weight: '500 g', price: 999 }],
  },
  {
    id: 'biryani-masala',
    name: 'Biryani Masala',
    tamilName: 'பிரியாணி மசாலா',
    category: 'Signature Masalas',
    image: '/spice-images/garam-masala.jpg',
    imageAlt: 'A traditional spice blend; representative ingredient photo, not retail packaging',
    variants: [{ weight: '100 g', price: 269 }, { weight: '200 g', price: 489 }, { weight: '500 g', price: 1099 }],
  },
  {
    id: 'sambar-powder',
    name: 'Sambar Powder',
    tamilName: 'சாம்பார் தூள்',
    category: 'Signature Masalas',
    image: '/spice-images/turmeric-spices.jpg',
    imageAlt: 'Assorted South Asian spice powders; representative ingredient photo, not retail packaging',
    variants: [{ weight: '100 g', price: 199 }, { weight: '200 g', price: 359 }, { weight: '500 g', price: 799 }],
  },
  {
    id: 'rasam-powder',
    name: 'Rasam Powder',
    tamilName: 'ரசம் தூள்',
    category: 'Signature Masalas',
    image: '/spice-images/garam-masala.jpg',
    imageAlt: 'A traditional spice blend; representative ingredient photo, not retail packaging',
    variants: [{ weight: '100 g', price: 189 }, { weight: '200 g', price: 339 }, { weight: '500 g', price: 749 }],
  },
  {
    id: 'cumin-seeds',
    name: 'Cumin Seeds',
    tamilName: 'சீரகம்',
    category: 'Whole Spices',
    image: '/spice-images/spice-assortment.jpg',
    imageAlt: 'Assorted whole spices; representative ingredient photo, not retail packaging',
    variants: [{ weight: '100 g', price: 149 }, { weight: '200 g', price: 269 }, { weight: '500 g', price: 599 }],
  },
  {
    id: 'spice-gift-box',
    name: 'Spice Gift Box',
    tamilName: 'மசாலா பரிசுப் பெட்டி',
    category: 'Gift Boxes',
    image: '/spice-images/spice-assortment.jpg',
    imageAlt: 'Assorted spices that may be included in a gift set; not gift-box packaging',
    variants: [{ weight: '3-piece set', price: 999 }, { weight: '6-piece set', price: 1799 }],
  },
];
