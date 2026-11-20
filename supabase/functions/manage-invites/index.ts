import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://esteticpro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Configuração do servidor incompleta." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Autenticação necessária." }, 401);
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Sessão inválida." }, 401);

    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: access, error: accessError } = await adminClient.from("user_access").select("role,status").eq("user_id", callerData.user.id).maybeSingle();
    if (accessError || access?.role !== "admin" || access?.status !== "approved") return json({ error: "Somente o administrador autorizado pode gerenciar convites." }, 403);

    const body = await req.json();
    const action = String(body.action ?? "");
    if (action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
      const { data: existing } = await adminClient.from("user_access").select("user_id,status").ilike("email", email).maybeSingle();
      if (existing) return json({ error: "Este e-mail já possui cadastro. Use o gerenciamento de acesso." }, 409);

      const raw = crypto.randomUUID() + crypto.randomUUID();
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const tokenHash = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
      const { error: inviteRowError } = await adminClient.from("access_invites").insert({
        email, created_by: callerData.user.id, token_hash: tokenHash, status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (inviteRowError) return json({ error: "Não foi possível registrar o convite." }, 500);

      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? "https://esteticpro.vercel.app/";
      const { error: sendError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (sendError) {
        await adminClient.from("access_invites").update({ status: "revoked" }).eq("token_hash", tokenHash);
        return json({ error: "O convite não foi enviado. Confira o SMTP e as configurações de e-mail do Supabase." }, 502);
      }
      return json({ ok: true, message: "Convite enviado. Ele expira em 7 dias." }, 200);
    }

    if (action === "list") {
      const { data, error } = await adminClient.from("access_invites")
        .select("id,email,status,created_at,expires_at,accepted_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) return json({ error: "Não foi possível carregar os convites." }, 500);
      return json({ invites: data ?? [] }, 200);
    }

    if (action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Informe o convite." }, 400);
      const { error } = await adminClient.from("access_invites").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
      if (error) return json({ error: "Não foi possível cancelar o convite." }, 500);
      return json({ ok: true }, 200);
    }

    if (action === "set_access") {
      const userId = String(body.user_id ?? "");
      const status = String(body.status ?? "");
      if (!userId || !["approved", "blocked"].includes(status)) return json({ error: "Dados de acesso inválidos." }, 400);
      if (userId === callerData.user.id && status === "blocked") return json({ error: "Não é permitido bloquear a própria conta administrativa." }, 400);
      const { error } = await adminClient.from("user_access").update({ status }).eq("user_id", userId);
      if (error) return json({ error: "Não foi possível atualizar o acesso." }, 500);
      return json({ ok: true }, 200);
    }
    return json({ error: "Ação desconhecida." }, 400);
  } catch {
    return json({ error: "Não foi possível concluir a solicitação." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
