type PgLikeError = {
  message?: string;
  code?: string;
};

/**
 * PostgREST / Postgres で「リレーション未作成」系の判定
 */
export function isMissingRelationError(
  error: PgLikeError,
  relationName: string,
): boolean {
  const message = error.message ?? "";
  return (
    message.includes(relationName) ||
    error.code === "PGRST205" ||
    error.code === "42P01"
  );
}
