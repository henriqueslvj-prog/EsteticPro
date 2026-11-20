import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SECRET_KEY = SECRET_KEYS["default"] || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }); }
function bearer(req: Request) { return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim(); }
async function getUser(req: Request) { const token = bearer(req); if (!token) return null; const { data, error } = await supabaseAdmin.auth.getUser(token); if (error) return null; return data.user ?? null; }
async function googleAccessToken(userId: string) {
  const { data: refreshToken, error } = await supabaseAdmin.rpc("get_google_drive_refresh_token", { p_user_id: userId });
  if (error) throw new Error(`Vault/Google token: ${error.message}`);
  if (!refreshToken) throw new Error("A conexão com o Google Drive precisa ser refeita.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const raw = await response.text(); let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `Google recusou o token (${response.status}). Reconecte o Google Drive.`);
  return data.access_token as string;
}
async function driveRequest(accessToken: string, url: string, init: RequestInit = {}) { const headers = new Headers(init.headers || {}); headers.set("Authorization", `Bearer ${accessToken}`); return fetch(url, { ...init, headers }); }
function driveQueryName(name: string) { return name.replaceAll("\\", "\\\\").replaceAll("'", "\\'"); }
async function findFolder(accessToken: string, name: string, parentId: string) {
  const q = [`name = '${driveQueryName(name)}'`, "mimeType = 'application/vnd.google-apps.folder'", "trashed = false", `'${parentId}' in parents`].join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files"); url.searchParams.set("q", q); url.searchParams.set("pageSize", "10"); url.searchParams.set("spaces", "drive"); url.searchParams.set("fields", "files(id,name,parents)");
  const response = await driveRequest(accessToken, url.toString()); const raw = await response.text(); let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) throw new Error(data?.error?.message || `Google Drive recusou a busca da pasta (${response.status}).`);
  return data.files?.[0] || null;
}
async function deleteDriveFile(accessToken: string, fileId: string) {
  const response = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  if (response.ok || response.status === 404) return;
  const raw = await response.text(); let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
  throw new Error(data?.error?.message || `Google Drive não permitiu excluir a imagem (${response.status}).`);
}
async function deleteDriveFolder(accessToken: string, folderId: string) {
  const response = await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}`, { method: "DELETE" });
  if (response.ok || response.status === 404) return;
  const raw = await response.text(); let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch {}
  throw new Error(data?.error?.message || `Google Drive não permitiu excluir a pasta (${response.status}).`);
}
async function listFolders(accessToken: string, query: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("fields", "files(id,name,mimeType)");
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Google Drive não permitiu listar pastas (${response.status}).`);
  return (data.files || []) as Array<{ id: string; name: string; mimeType: string }>;
}
async function findDayFolderForClient(accessToken: string, clientsFolderId: string, clientId: string, isoDate: string) {
  const clientFolders = await listFolders(accessToken, `appProperties has { key='esteticpro_client_id' and value='${clientId}' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${clientsFolderId}' in parents`);
  if (!clientFolders[0]) return null;
  const days = await listFolders(accessToken, `appProperties has { key='esteticpro_evolution_date' and value='${isoDate}' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${clientFolders[0].id}' in parents`);
  return days[0] || null;
}
async function isFolderEmpty(accessToken: string, folderId: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("fields", "files(id)");
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json().catch(() => ({}));
  return response.ok && !(data.files || []).length;
}
function readable(value: string, max = 70) { return value.replace(/[^a-zA-Z0-9À-ÿ _-]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "Sem procedimento"; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Configuração do Supabase incompleta.");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("Credenciais Google não configuradas na Edge Function.");
    const user = await getUser(req); if (!user) return json({ error: "Sessão inválida ou expirada. Faça login novamente." }, 401);
    const body = await req.json().catch(() => ({})); const evolutionId = String(body?.evolution_id || "").trim();
    if (!evolutionId) return json({ error: "ID da evolução não informado." }, 400);

    const { data: evolution, error: evoError } = await supabaseAdmin.from("client_evolutions").select("id,user_id,client_id,procedure_name,evolution_date").eq("id", evolutionId).eq("user_id", user.id).maybeSingle();
    if (evoError) throw new Error(`Erro ao validar evolução: ${evoError.message}`); if (!evolution) return json({ error: "A evolução não pertence ao usuário autenticado." }, 403);
    const { data: photos, error: photosError } = await supabaseAdmin.from("evolution_photos").select("id,drive_file_id,file_name").eq("evolution_id", evolution.id).eq("user_id", user.id);
    if (photosError) throw new Error(`Erro ao localizar fotos da evolução: ${photosError.message}`);

    const accessToken = await googleAccessToken(user.id);
    for (const photo of photos || []) if (photo.drive_file_id) await deleteDriveFile(accessToken, photo.drive_file_id);

    const { data: client } = await supabaseAdmin.from("clients").select("full_name").eq("id", evolution.client_id).eq("user_id", user.id).maybeSingle();
    const { data: connection, error: connectionError } = await supabaseAdmin.from("google_drive_connections").select("root_folder_id").eq("user_id", user.id).maybeSingle();
    if (connectionError) throw new Error(`Erro ao consultar conexão do Google Drive: ${connectionError.message}`);

    if (connection?.root_folder_id) {
      const clientsFolder = await findFolder(accessToken, "Clientes", connection.root_folder_id);
      if (clientsFolder) {
        // Estrutura nova: Clientes / <Nome> / Evolução dd/mm/aaaa (uma pasta por dia, compartilhada pelas evoluções do dia).
        const dayFolder = await findDayFolderForClient(accessToken, clientsFolder.id, evolution.client_id, String(evolution.evolution_date));
        if (dayFolder && await isFolderEmpty(accessToken, dayFolder.id)) await deleteDriveFolder(accessToken, dayFolder.id);

        // Estruturas antigas (uma pasta por evolução): mantidas para limpar o que já existe.
        const clientReadableName = `${readable(client?.full_name || "Cliente", 100)} - ${evolution.client_id.slice(0, 6)}`;
        const clientFolder = await findFolder(accessToken, clientReadableName, clientsFolder.id) || await findFolder(accessToken, `Cliente-${evolution.client_id}`, clientsFolder.id);
        if (clientFolder) {
          const [y, m, d] = String(evolution.evolution_date).split("-");
          const evolutionReadableName = `Evolução - ${d}-${m}-${y} - ${readable(evolution.procedure_name || "Sem procedimento")} - ${evolution.id.slice(0, 6)}`;
          const readableFolder = await findFolder(accessToken, evolutionReadableName, clientFolder.id);
          const legacyFolder = await findFolder(accessToken, `Evolucao-${evolution.id}`, clientFolder.id);
          if (readableFolder) await deleteDriveFolder(accessToken, readableFolder.id);
          else if (legacyFolder) await deleteDriveFolder(accessToken, legacyFolder.id);
        }
      }
    }

    const { error: deleteError } = await supabaseAdmin.from("client_evolutions").delete().eq("id", evolution.id).eq("user_id", user.id);
    if (deleteError) throw new Error(`As imagens foram removidas do Google Drive, mas não conseguimos excluir o registro no EsteticPro: ${deleteError.message}`);
    return json({ success: true, deleted_photos: photos?.length || 0, evolution_id: evolution.id });
  } catch (error) {
    console.error("google-drive-delete-evolution:", error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível excluir a evolução." }, 500);
  }
});
