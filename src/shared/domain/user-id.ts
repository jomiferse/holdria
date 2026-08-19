/**
 * Branded identifier for the canonical Holdria user.
 *
 * The underlying value is the UUID primary key Better Auth generates for
 * its `user` row. Only identity infrastructure may read or construct a
 * `UserId` from a Better Auth session; every other module receives it as an
 * opaque value and must never import Better Auth types itself.
 */
export type UserId = string & { readonly __brand: "UserId" };

/** Construct a `UserId` from a trusted UUID (identity infrastructure only). */
export function toUserId(value: string): UserId {
  return value as UserId;
}
