import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "anthropic/claude-sonnet-5";
// Estimated price per million tokens (USD), used for cost tracking.
const PRICE_IN = 3;
const PRICE_OUT = 15;
export const MONTHLY_LIMIT_USD = 20;

export const GLOBAL_RULES = `REGRAS FIXAS DO MOTOR DE CRIATIVOS (TikTok Shop Brasil, português do Brasil):
- Falas de 10 segundos: entre 25 e 30 palavras. Proporcional para outras durações (8s ≈ 20-24, 16s ≈ 40-48).
- Vídeos de 16 e 20 segundos: dividir em cenas de 8s ou 10s (20s = duas cenas de 10s).
- Estilo UGC natural, pessoa real, movimentos realistas, câmera de celular.
- Gancho forte nos primeiros 3 segundos.
- Preservar apenas características CONFIRMADAS do produto. Nunca inventar bolsos, etiquetas, cores, materiais, quantidades ou benefícios.
- Descrição com exatamente 5 hashtags: #tiktokshop1111 #TIKTOKSHOPBR1111 #BlackFriday + 2 relevantes ao produto.
- Evitar alegações comerciais arriscadas (cura, garantias absolutas, "o melhor do mundo", promessas médicas).`;

type Content = Anthropic.Messages.ContentBlockParam[];

export async function callClaude<T>(opts: {
  system: string;
  content: Content;
  schema: Record<string, unknown>;
}): Promise<{ data: T; inputTokens: number; outputTokens: number; cost: number }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Chave de IA não configurada.");
  const client = new Anthropic({
    baseURL: "https://ai.gateway.lovable.dev",
    apiKey,
    maxRetries: 0,
    defaultHeaders: { "X-Lovable-AIG-SDK": "anthropic-sdk" },
  });
  let msg: Anthropic.Messages.Message;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      // output_config is supported by the gateway
      ...({ output_config: { format: { type: "json_schema", schema: opts.schema } } } as object),
    });
    msg = await stream.finalMessage();
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
    if (err.status === 429) throw new Error("Muitas solicitações. Aguarde um pouco e tente novamente.");
    if (err.status === 403) throw new Error("Acesso ao modelo negado: " + (err.message ?? ""));
    throw new Error("Falha na IA: " + (err.message ?? "erro desconhecido"));
  }
  if (msg.stop_reason === "refusal") throw new Error("A IA recusou esta solicitação.");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("Resposta da IA em formato inválido. Tente novamente.");
  }
  const inputTokens = msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0);
  const outputTokens = msg.usage.output_tokens;
  const cost = (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
  return { data, inputTokens, outputTokens, cost };
}
