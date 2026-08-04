export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://biab:biab@localhost:5432/biab",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-replace-me-32-bytes!!",
  allowDevAuth:
    process.env.ALLOW_DEV_AUTH === "true" ||
    process.env.NODE_ENV !== "production",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
  /** Default tenant for dev mint / seed */
  devTenantId: "11111111-1111-1111-1111-111111111111",
  devUserSub: "dev-tiny",
  devUserEmail: "tiny@thinktanksolutionsai.com",
  devUserName: "Tiny",
} as const;
