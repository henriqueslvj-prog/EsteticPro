import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://esteticpro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return json({ error: "Função não configurada no servidor." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user?.email) return json({ error: "Sessão inválida." }, 401);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  let input: { action?: string; email?: string; inviteId?: string };
  try { input = await req.json(); } catch { return json({ error: "Requisição inválida." }, 400); }

  // Invitees may activate their own access only after confirming the invitation email.
  if (input.action === "accept") {
    if (!user.email_confirmed_at) return json({ error: "Confirme o convite pelo link enviado ao seu e-mail antes de ativar o acesso." }, 403);
    const email = user.email.toLowerCase();
    const { data: invite, error: inviteError } = await admin.from("access_invites")
      .select("id,email,status,expires_at").eq("email", email).eq("status", "pending").maybeSingle();
    if (inviteError) return json({ error: "Não foi possível validar o convite." }, 500);
    if (!invite || new Date(invite.expires_at).getTime() < Date.now()) return json({ error: "Não há convite pendente válido para este e-mail." }, 403);
    const { error: upsertError } = await admin.from("user_access").upsert({
      user_id: user.id, email, role: "professional", status: "approved", updated_at: new Date().toISOString()
    });
    if (upsertError) return json({ error: "Não foi possível ativar o acesso." }, 500);
    const { error: acceptError } = await admin.from("access_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
    if (acceptError) return json({ error: "Acesso ativado, mas não foi possível atualizar o convite. Avise o administrador." }, 500);
    return json({ ok: true, status: "approved" });
  }

  const { data: access, error: accessError } = await admin.from("user_access")
    .select("role,status").eq("user_id", user.id).maybeSingle();
  if (accessError) return json({ error: "Não foi possível validar as permissões." }, 500);
  if (access?.role !== "admin" || access?.status !== "approved" || user.email.toLowerCase() !== "henriqueslvj@gmail.com") {
    return json({ error: "Somente o administrador autorizado pode gerenciar convites." }, 403);
  }

  if (input.action === "list") {
    const { data, error } = await admin.from("access_invites")
      .select("id,email,status,expires_at,created_at,accepted_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: "Não foi possível listar convites." }, 500);
    return json({ invites: data || [] });
  }

  if (input.action === "revoke") {
    if (!input.inviteId) return json({ error: "Informe o convite." }, 400);
    const { data, error } = await admin.from("access_invites")
      .update({ status: "revoked" }).eq("id", input.inviteId).eq("status", "pending")
      .select("id").maybeSingle();
    if (error) return json({ error: "Não foi possível cancelar o convite." }, 500);
    if (!data) return json({ error: "Convite não encontrado ou já não está pendente." }, 404);
    return json({ ok: true });
  }

  if (input.action === "invite") {
    const email = (input.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (email === "henriqueslvj@gmail.com") return json({ error: "A conta administradora não precisa de convite." }, 400);

    const { data: existingUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existingUser?.users?.some((candidate) => candidate.email?.toLowerCase() === email)) {
      return json({ error: "Este e-mail já possui uma conta. Use a gestão de acesso para autorizá-la." }, 409);
    }
    const { data: existingInvite } = await admin.from("access_invites")
      .select("id,status").eq("email", email).eq("status", "pending").maybeSingle();
    if (existingInvite) return json({ error: "Já existe um convite pendente para este e-mail." }, 409);

    const { data: invite, error: insertError } = await admin.from("access_invites").insert({
      email, created_by: user.id, status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select("id,email,status,expires_at,created_at").single();
    if (insertError) return json({ error: "Não foi possível registrar o convite." }, 500);

    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || "https://esteticpro.vercel.app/";
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) {
      await admin.from("access_invites").update({ status: "revoked" }).eq("id", invite.id);
      return json({ error: "O convite não foi enviado. Confira a configuração SMTP/e-mail do Supabase." }, 502);
    }
    return json({ ok: true, invite });
  }

  return json({ error: "Ação inválida." }, 400);
});
