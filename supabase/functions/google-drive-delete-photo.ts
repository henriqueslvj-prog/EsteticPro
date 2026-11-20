import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getSecretKey() {
  const keys = JSON.parse(SUPABASE_SECRET_KEYS);
  const key = keys["default"];
  if (!key) throw new Error("SUPABASE_SECRET_KEYS não contém a chave default.");
  return key;
}

async function getGoogleAccessToken(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin.rpc("get_google_drive_refresh_token", { p_user_id: userId });
  if (error) throw new Error(`Não foi possível recuperar o refresh token do Google: ${error.message}`);
  if (!data) throw new Error("A conta Google Drive não está conectada ou o refresh token não foi encontrado.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: data, grant_type: "refresh_token" }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description || result.error || "Não foi possível renovar o token do Google.");
  return result.access_token as string;
}

async function deleteDriveFile(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.ok || response.status === 404) return;
  let details = "";
  try { const body = await response.json(); details = body?.error?.message || ""; } catch (_) {}
  if (response.status === 401) throw new Error("O acesso ao Google Drive expirou ou foi revogado. Reconecte o Google Drive no EsteticPro.");
  if (response.status === 403) throw new Error("O Google Drive recusou a exclusão desta imagem. Verifique as permissões da conta conectada.");
  throw new Error(`Não foi possível excluir a imagem do Google Drive.${details ? ` ${details}` : ""}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Usuário não autenticado." }, 401);
    const jwt = authorization.replace("Bearer ", "").trim();
    const secretKey = getSecretKey();
    const supabaseAdmin = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) return jsonResponse({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json().catch(() => null);
    const photoId = body?.photo_id?.trim();
    if (!photoId) return jsonResponse({ error: "photo_id é obrigatório." }, 400);

    const { data: photo, error: photoError } = await supabaseAdmin
      .from("evolution_photos")
      .select("id,user_id,evolution_id,drive_file_id")
      .eq("id", photoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (photoError) throw new Error(`Erro ao consultar a foto: ${photoError.message}`);
    if (!photo) return jsonResponse({ error: "Foto não encontrada." }, 404);

    if (photo.drive_file_id) {
      const accessToken = await getGoogleAccessToken(supabaseAdmin, user.id);
      await deleteDriveFile(accessToken, photo.drive_file_id);
    }

    const { error: deleteError } = await supabaseAdmin.from("evolution_photos").delete().eq("id", photo.id).eq("user_id", user.id);
    if (deleteError) throw new Error(`A imagem foi removida do Drive, mas não foi possível remover a referência no banco: ${deleteError.message}`);

    return jsonResponse({ success: true, photo_id: photo.id, evolution_id: photo.evolution_id });
  } catch (error) {
    console.error("google-drive-delete-photo error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno ao excluir a foto." }, 500);
  }
});
