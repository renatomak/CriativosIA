import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

async function ai() {
  return await import("./ai.server");
}

async function checkBudget(sb: Sb) {
  const { MONTHLY_LIMIT_USD } = await ai();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { data } = await sb.from("ai_usage").select("cost_usd").gte("created_at", start.toISOString());
  const spent = (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  if (spent >= MONTHLY_LIMIT_USD)
    throw new Error(`Limite mensal de US$ ${MONTHLY_LIMIT_USD} atingido.`);
}

async function logUsage(sb: Sb, userId: string, operation: string, r: { inputTokens: number; outputTokens: number; cost: number }) {
  const { MODEL } = await ai();
  await sb.from("ai_usage").insert({
    user_id: userId,
    operation,
    model: MODEL,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    cost_usd: r.cost,
  });
}

async function loadProduct(sb: Sb, id: string) {
  const { data, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Produto não encontrado.");
  return data;
}

async function imageBlocks(sb: Sb, paths: string[]) {
  const blocks: { type: "image"; source: { type: "url"; url: string } }[] = [];
  for (const p of paths.slice(0, 6)) {
    const { data } = await sb.storage.from("product-images").createSignedUrl(p, 600);
    if (data?.signedUrl) blocks.push({ type: "image", source: { type: "url", url: data.signedUrl } });
  }
  return blocks;
}

const specSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    categoria: { type: "string" },
    confirmadas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { atributo: { type: "string" }, valor: { type: "string" } },
        required: ["atributo", "valor"],
      },
    },
    incertas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { atributo: { type: "string" }, valor: { type: "string" }, motivo: { type: "string" } },
        required: ["atributo", "valor", "motivo"],
      },
    },
  },
  required: ["categoria", "confirmadas", "incertas"],
};

export const analyzeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await checkBudget(sb);
    const p = await loadProduct(sb, data.id);
    const { callClaude } = await ai();
    const r = await callClaude<{ categoria: string; confirmadas: { atributo: string; valor: string }[]; incertas: { atributo: string; valor: string; motivo: string }[] }>({
      system:
        "Você analisa produtos de anúncios do TikTok Shop. Extraia características (cores, materiais, etiquetas, quantidades, tamanhos, acessórios). Só marque como CONFIRMADA o que estiver visível nas fotos ou escrito explicitamente na descrição. Qualquer dúvida vai para INCERTAS com o motivo. Responda em português.",
      content: [
        ...(await imageBlocks(sb, p.image_paths)),
        { type: "text", text: `Nome: ${p.name}\nDescrição: ${p.description ?? ""}\nLink: ${p.ad_link ?? ""}` },
      ],
      schema: specSchema,
    });
    await logUsage(sb, context.userId, "analyze", r);
    await sb.from("products").update({ specs: r.data as never }).eq("id", p.id);
    return r.data;
  });

const creativeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    gancho: { type: "string" },
    cenas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          numero: { type: "integer" },
          duracao_segundos: { type: "integer" },
          fala: { type: "string" },
          texto_na_tela: { type: "string" },
          roteiro_ugc: { type: "string" },
          prompt_imagem: { type: "string" },
          prompt_video: { type: "string" },
        },
        required: ["numero", "duracao_segundos", "fala", "texto_na_tela", "roteiro_ugc", "prompt_imagem", "prompt_video"],
      },
    },
    descricao: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["gancho", "cenas", "descricao", "hashtags"],
};

async function generate(sb: Sb, userId: string, productId: string, duration: number, parent?: { id: string; content: unknown }, instructions?: string) {
  await checkBudget(sb);
  const p = await loadProduct(sb, productId);
  if (!p.specs) throw new Error("Analise e confirme a ficha técnica antes de gerar.");
  const { callClaude, GLOBAL_RULES, MODEL } = await ai();
  const parts = [
    `Produto: ${p.name}`,
    `Descrição: ${p.description ?? ""}`,
    `Ficha técnica (use só as confirmadas como fatos): ${JSON.stringify(p.specs)}`,
    p.rules ? `Regras específicas deste produto: ${p.rules}` : "",
    `Duração do criativo: ${duration} segundos.`,
    parent ? `Crie uma NOVA VERSÃO diferente (outro gancho e abordagem) deste criativo, preservando todas as características do produto: ${JSON.stringify(parent.content)}` : "",
    instructions ? `Instruções extras: ${instructions}` : "",
  ].filter(Boolean);
  const r = await callClaude<Record<string, string | number | object>>({
    system: `Você é um roteirista especialista em criativos UGC virais para TikTok Shop.\n${GLOBAL_RULES}\nPrompts de imagem e vídeo podem ser em português, detalhados, descrevendo o produto fielmente.`,
    content: [...(await imageBlocks(sb, p.image_paths.slice(0, 3))), { type: "text", text: parts.join("\n\n") }],
    schema: creativeSchema,
  });
  await logUsage(sb, userId, parent ? "variant" : "creative", r);
  const { data: row, error } = await sb
    .from("creatives")
    .insert({
      user_id: userId,
      product_id: p.id,
      parent_id: parent?.id ?? null,
      duration,
      content: r.data as never,
      model: MODEL,
      cost_usd: r.cost,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export const createCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ productId: z.string().uuid(), duration: z.union([z.literal(8), z.literal(10), z.literal(16), z.literal(20)]), instructions: z.string().max(1000).optional() }).parse(d),
  )
  .handler(({ data, context }) => generate(context.supabase, context.userId, data.productId, data.duration, undefined, data.instructions));

export const createVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), instructions: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("creatives").select("*").eq("id", data.id).single();
    if (!c) throw new Error("Criativo não encontrado.");
    return generate(context.supabase, context.userId, c.product_id, c.duration, { id: c.id, content: c.content }, data.instructions);
  });

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    aprovado: { type: "boolean" },
    resumo: { type: "string" },
    alertas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          gravidade: { type: "string", enum: ["alta", "media", "baixa"] },
          tipo: { type: "string", enum: ["atributo_inventado", "inconsistencia", "alegacao_arriscada", "regra_violada"] },
          trecho: { type: "string" },
          sugestao: { type: "string" },
        },
        required: ["gravidade", "tipo", "trecho", "sugestao"],
      },
    },
  },
  required: ["aprovado", "resumo", "alertas"],
};

export const reviewCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await checkBudget(sb);
    const { data: c } = await sb.from("creatives").select("*").eq("id", data.id).single();
    if (!c) throw new Error("Criativo não encontrado.");
    const p = await loadProduct(sb, c.product_id);
    const { callClaude, GLOBAL_RULES } = await ai();
    const r = await callClaude<{ aprovado: boolean; resumo: string; alertas: { gravidade: string; tipo: string; trecho: string; sugestao: string }[] }>({
      system: `Você é um revisor rigoroso de fidelidade e conformidade de criativos do TikTok Shop. Compare o criativo com a ficha técnica e as fotos. Aponte atributos inventados, inconsistências, alegações comerciais arriscadas e violações das regras. Contagem de palavras das falas e hashtags devem ser verificadas.\n${GLOBAL_RULES}`,
      content: [
        ...(await imageBlocks(sb, p.image_paths.slice(0, 3))),
        { type: "text", text: `Ficha: ${JSON.stringify(p.specs)}\nRegras do produto: ${p.rules ?? "nenhuma"}\nDuração: ${c.duration}s\nCriativo: ${JSON.stringify(c.content)}` },
      ],
      schema: reviewSchema,
    });
    await logUsage(sb, context.userId, "review", r);
    await sb.from("creatives").update({ review: r.data as never, cost_usd: Number(c.cost_usd) + r.cost }).eq("id", c.id);
    return r.data;
  });
