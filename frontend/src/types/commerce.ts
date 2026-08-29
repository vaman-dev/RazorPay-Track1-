export interface Product {
  id: string;
  name: string;
  slug: string;

  description: string;
  shortDescription: string;

  price: number;
  currency: "INR";

  merchant: string;

  category: ProductCategory;

  image: string;
  images?: string[];

  stock: number;

  rating?: number;
  reviewCount?: number;

  featured?: boolean;
}

export type ProductCategory =
  | "Footwear"
  | "Electronics"
  | "Accessories";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CommerceCart {
  items: CartItem[];
  subtotal: number;
  currency: "INR";
  itemCount: number;
}