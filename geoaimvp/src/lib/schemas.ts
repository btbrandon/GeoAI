import { z } from "zod";

export const SpatialOperationSchema = z.object({
  operation: z.enum(["buffer", "within", "nearest"]),
  distance: z.number().min(0.01).max(100),
});

export const requestBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  pins: z
    .array(
      z.object({
        id: z.string(),
        longitude: z.number(),
        latitude: z.number(),
        coordinates: z.tuple([z.number(), z.number()]),
      })
    )
    .optional(),
  referencePoint: z
    .object({
      id: z.string(),
      longitude: z.number(),
      latitude: z.number(),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
});

const operationSchema = z.object({
  op: z.enum(["within", "nearest", "buffer"]),
  params: z.union([
    z.object({ distance_km: z.number().positive() }),
    z.object({ k: z.number().int().positive().default(5) }),
    z.object({ distance: z.number().positive() }),
  ]),
});

export type RequestBody = z.infer<typeof requestBodySchema>;
export type Operation = z.infer<typeof operationSchema>;
