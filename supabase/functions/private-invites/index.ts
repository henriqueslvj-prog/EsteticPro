// EsteticPro V29 — admin-only invitation management
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://esteticpro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return respond({ error: "Função não configurada no servidor." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return respond({ error: "Autenticação obrigatória." }, 401);
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user || user.email?.toLowerCase() !== "henriqueslvj@gmail.com") {
    return respond({ error: "Somente o administrador inicial pode gerenciar convites." }, 403);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: access, error: accessError } = await admin.from("user_access")
    .select("role,status").eq("user_id", user.id).maybeSingle();
  if (accessError || access?.role !== "admin" || access?.status !== "approved") {
    return respond({ error: "Conta administradora não está autorizada no banco." }, 403);
  }

  try {
    const body = await req.json();
    const action = body?.action;
    if (action === "list") {
      const { data, error } = await admin.from("access_invites")
        .select("id,email,status,expires_at,created_at,accepted_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return respond({ invites: data ?? [] });
    }

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Informe um e-mail válido." }, 400);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHex = [...new Uint8Array(tokenHash)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const { data: invite, error: inviteError } = await admin.from("access_invites")
        .insert({ email, created_by: user.id, token_hash: tokenHex, status: "pending" })
        .select("id,email,status,expires_at,created_at").single();
      if (inviteError) throw inviteError;
      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? "https://esteticpro.vercel.app";
      const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { esteticpro_invite_id: invite.id },
      });
      if (mailError) {
        await admin.from("access_invites").update({ status: "revoked" }).eq("id", invite.id);
        return respond({ error: "O convite foi cancelado porque o Supabase não conseguiu enviar o e-mail. Verifique o SMTP e a configuração de Auth." }, 502);
      }
      return respond({ invite, message: "Convite enviado por e-mail. Ele expira em 7 dias." }, 201);
    }

    if (action === "revoke") {
      const id = String(body?.id ?? "");
      if (!id) return respond({ error: "Informe o convite." }, 400);
      const { data, error } = await admin.from("access_invites").update({ status: "revoked" })
        .eq("id", id).eq("status", "pending").select("id,email,status").maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: "Convite não encontrado ou não está pendente." }, 404);
      return respond({ invite: data });
    }

    if (action === "block_user") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!email || email === "henriqueslvj@gmail.com") return respond({ error: "Não é permitido bloquear a conta administradora inicial por esta função." }, 400);
      const { data: target, error: targetError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (targetError) throw targetError;
      const targetUser = target.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (!targetUser) return respond({ error: "Conta não encontrada." }, 404);
      const { error } = await admin.from("user_access").upsert({
        user_id: targetUser.id, email, role: "professional", status: "blocked", updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await admin.auth.admin.updateUserById(targetUser.id, { ban_duration: "876000h" });
      return respond({ message: "Conta bloqueada." });
    }

    return respond({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("private-invites error", error);
    return respond({ error: "Não foi possível concluir a operação. Verifique os logs da função." }, 500);
  }
});
