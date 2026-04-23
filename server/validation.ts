import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ── Reusable helpers ──

const shortStr = (max = 200) => z.string().trim().max(max);
const optionalString = shortStr().optional();
const optionalDate = z.string().date().optional().or(z.literal("").transform(() => undefined));
const currency = z.enum(["EUR", "USD", "ALL"]).default("EUR");

// ── Auth ──

export const loginSchema = z.object({
  email: z.string().trim().max(254).email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

export const registerSchema = z.object({
  email: z.string().trim().max(254).email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
});

// ── Cargos ──

export const createCargoSchema = z.object({
  cargo_code: shortStr(50).min(1, "Cargo code is required"),
  departure_country: shortStr(100).min(1, "Departure country is required"),
  destination_country: shortStr(100).min(1, "Destination country is required"),
  departure_date: optionalDate,
  arrival_date: optionalDate,
  status: z.enum(["pending", "in_transit", "delivered"]).default("pending"),
  currency: currency,
});

export const updateCargoSchema = createCargoSchema.partial();

// ── Packages ──

export const createPackageSchema = z.object({
  package_code: shortStr(50).min(1, "Package code is required"),
  product_name: shortStr(200).min(1, "Product name is required"),
  price: z.coerce.number().min(0).default(0),
  currency: currency,
  payment_status: z.enum(["paid", "on_delivery", "partly"]).default("paid"),
  amount_paid: z.coerce.number().min(0).optional(),
  amount_remaining: z.coerce.number().min(0).optional(),
  client_name: shortStr(200).optional(),
  client_phone: shortStr(50).optional(),
  client_email: z.string().trim().max(254).email().optional().or(z.literal("")),
  client_id_number: shortStr(50).optional(),
  destination_location: shortStr(500).optional(),
  delivery_date: optionalDate,
  arrival_date: optionalDate,
  image_url: shortStr(2000).optional(),
  cargo_id: shortStr(100).nullable().optional(),
  section_id: shortStr(100).nullable().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();

// ── Clients ──

export const createClientSchema = z.object({
  name: shortStr(200).min(1, "Client name is required"),
  phone: shortStr(50).optional(),
  email: z.string().trim().max(254).email().optional().or(z.literal("")),
  id_number: shortStr(50).optional(),
  address: shortStr(500).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ── Warehouses ──

export const createWarehouseSchema = z.object({
  name: shortStr(200).min(1, "Warehouse name is required"),
  location: shortStr(500).optional(),
  canvas_width: z.coerce.number().int().positive().max(10000).default(800),
  canvas_height: z.coerce.number().int().positive().max(10000).default(600),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

// ── Sections ──

export const createSectionSchema = z.object({
  warehouse_id: z.string().uuid("Invalid warehouse ID"),
  name: shortStr(100).min(1, "Section name is required"),
  color: z.string().max(20).default("#3b82f6"),
  x: z.coerce.number().default(0),
  y: z.coerce.number().default(0),
  width: z.coerce.number().positive().max(10000).default(100),
  height: z.coerce.number().positive().max(10000).default(100),
});

export const updateSectionSchema = createSectionSchema.omit({ warehouse_id: true }).partial();

// ── Exchange Rates ──

export const exchangeRatesSchema = z.array(
  z.object({
    from_currency: z.string().trim().min(1).max(10),
    to_currency: z.string().trim().min(1).max(10),
    rate: z.coerce.number().positive("Rate must be positive"),
  }),
).max(50);

// ── Middleware factory ──

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      res.status(400).json({ message: errors[0], errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
