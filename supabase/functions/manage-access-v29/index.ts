// EsteticPro V29 — convite e gerenciamento de acesso.
// Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Supabase function secrets.
// Never expose the service-role key to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://esteticpro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Configuração interna ausente." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authHeader.slice(7);
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  const { data: access, error: accessError } = await adminClient
    .from("user_access").select("role,status").eq("user_id", user.id).maybeSingle();
  if (accessError) return json({ error: "Não foi possível verificar a autorização." }, 500);
  if (access?.role !== "admin" || access?.status !== "approved") return json({ error: "Apenas o administrador pode gerenciar acessos." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido." }, 400); }
  const action = String(body.action ?? "");

  if (action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (email === String(user.email ?? "").toLowerCase()) return json({ error: "Esta é a conta administradora." }, 400);
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: Deno.env.get("APP_ORIGIN") ?? "https://esteticpro.vercel.app",
      data: { invited_by: user.id, access_type: "esteticpro_invite" },
    });
    if (inviteError) return json({ error: inviteError.message.includes("already") ? "Este e-mail já possui uma conta ou convite." : "Não foi possível enviar o convite. Confira o e-mail e tente novamente." }, 400);
    const { error: upsertError } = await adminClient.from("user_access").upsert({
      user_id: invited.user.id, email, role: "professional", status: "approved", updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upsertError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return json({ error: "O convite não pôde ser registrado. Nenhum acesso foi liberado." }, 500);
    }
    return json({ ok: true, message: "Convite enviado. O acesso ficará disponível após a confirmação do e-mail.", email });
  }

  if (action === "list") {
    const { data, error } = await adminClient.from("user_access")
      .select("user_id,email,role,status,created_at,updated_at").order("created_at", { ascending: false });
    if (error) return json({ error: "Não foi possível carregar a lista de acessos." }, 500);
    return json({ users: data ?? [] });
  }

  if (action === "set_status") {
    const userId = String(body.user_id ?? "");
    const status = String(body.status ?? "");
    if (!userId || !["approved", "blocked"].includes(status)) return json({ error: "Parâmetros inválidos." }, 400);
    if (userId === user.id) return json({ error: "A conta administradora não pode ser bloqueada por esta tela." }, 400);
    const { error } = await adminClient.from("user_access")
      .update({ status, updated_at: new Date().toISOString() }).eq("user_id", userId).neq("role", "admin");
    if (error) return json({ error: "Não foi possível alterar o acesso." }, 500);
    return json({ ok: true });
  }

  return json({ error: "Ação não reconhecida." }, 400);
});
