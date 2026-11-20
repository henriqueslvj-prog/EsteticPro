import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const APP_ORIGIN = "https://esteticpro.vercel.app";
const ADMIN_EMAIL = "henriqueslvj@gmail.com";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;


// CORS explícito para evitar depender dos cabeçalhos padrão de uma
// importação externa. A função só autoriza o domínio oficial do aplicativo.
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const fail = (message: string, status = 400) =>
  json({ success: false, error: message }, status);

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function getBearerToken(req: Request): string | null {
  const value = req.headers.get("Authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isAdminEmail(email: string): boolean {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

Deno.serve(async (req: Request) => {
  // Preflight CORS: responder antes de exigir autenticação.
  if (req.method === "OPTIONS") {
    // Responder imediatamente ao preflight, sem autenticação nem acesso ao banco.
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return fail("Método não permitido.", 405);
  }

  if (!supabase) {
    console.error("Configuração Supabase ausente.");
    return fail("Serviço de acesso não configurado.", 500);
  }

  // Validar a origem quando o navegador a envia.
  const origin = req.headers.get("Origin");
  if (origin && origin !== APP_ORIGIN) {
    return fail("Origem não autorizada.", 403);
  }

  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return fail("Sessão ausente. Entre novamente no EsteticPro.", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user || !user.email) {
      return fail("Sessão inválida ou expirada.", 401);
    }

    const userEmail = normalizeEmail(user.email);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail("O corpo da requisição não contém JSON válido.");
    }

    const action = String(body.action ?? "").trim();

    // Aceitação de convite: o usuário autenticado aceita o convite
    // destinado ao próprio endereço de e-mail.
    if (action === "accept_invite") {
      const token =
        typeof body.token === "string" ? body.token.trim() : "";

      if (!token || token.length > 512) {
        return fail("Token do convite inválido.");
      }

      const tokenHash = await sha256(token);

      const { data: invite, error: inviteError } = await supabase
        .from("access_invites")
        .select("id, email, status, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (inviteError) {
        console.error("Erro ao consultar convite:", inviteError.message);
        return fail("Não foi possível validar o convite.", 500);
      }

      if (!invite || invite.status !== "pending") {
        return fail("Convite inválido, já utilizado ou revogado.", 400);
      }

      if (normalizeEmail(invite.email) !== userEmail) {
        return fail(
          "O convite pertence a outro endereço de e-mail.",
          403,
        );
      }

      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        await supabase
          .from("access_invites")
          .update({ status: "expired" })
          .eq("id", invite.id)
          .eq("status", "pending");

        return fail("Este convite expirou.", 410);
      }

      // Não permitir que um convite comum altere o administrador.
      const { data: existingAccess, error: accessLookupError } =
        await supabase
          .from("user_access")
          .select("user_id, role, status")
          .eq("user_id", user.id)
          .maybeSingle();

      if (accessLookupError) {
        console.error(
          "Erro ao consultar acesso:",
          accessLookupError.message,
        );
        return fail("Não foi possível consultar seu acesso.", 500);
      }

      if (
        existingAccess &&
        existingAccess.role === "admin" &&
        isAdminEmail(userEmail)
      ) {
        return json({
          success: true,
          message: "A conta administradora já possui acesso.",
        });
      }

      // Reivindicar o convite condicionalmente. Apenas uma requisição
      // consegue mudar o status de pending para accepted.
      const { data: claimedInvite, error: claimError } = await supabase
        .from("access_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError || !claimedInvite) {
        return fail(
          "O convite já foi utilizado ou não pode mais ser aceito.",
          409,
        );
      }

      // Convites comuns nunca concedem função de administrador.
      const accessRow = {
        user_id: user.id,
        email: userEmail,
        role: "professional",
        status: "pending",
      };

      let saveError;

      if (existingAccess) {
        const result = await supabase
          .from("user_access")
          .update({
            email: userEmail,
            role: "professional",
            status: "pending",
          })
          .eq("user_id", user.id);

        saveError = result.error;
      } else {
        const result = await supabase
          .from("user_access")
          .insert(accessRow);

        saveError = result.error;
      }

      if (saveError) {
        console.error("Erro ao criar acesso:", saveError.message);

        // O convite não fica preso como aceito se a gravação falhar.
        await supabase
          .from("access_invites")
          .update({
            status: "pending",
            accepted_at: null,
          })
          .eq("id", invite.id)
          .eq("status", "accepted");

        return fail("Não foi possível registrar seu acesso.", 500);
      }

      return json({
        success: true,
        status: "pending",
        message: "Convite aceito. Aguarde a aprovação do administrador.",
      });
    }

    // Ações restantes são exclusivas do administrador.
    const { data: adminAccess, error: adminLookupError } =
      await supabase
        .from("user_access")
        .select("role, status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminLookupError) {
      console.error(
        "Erro ao validar administrador:",
        adminLookupError.message,
      );
      return fail("Não foi possível validar suas permissões.", 500);
    }

    const isInitialAdmin = isAdminEmail(userEmail);
    const hasAdminRole =
      adminAccess?.role === "admin" &&
      adminAccess?.status === "approved";

    if (!isInitialAdmin && !hasAdminRole) {
      return fail("Apenas administradores podem gerenciar acessos.", 403);
    }

    // LISTAR ACESSOS E CONVITES
    if (action === "list") {
      const [accessResult, inviteResult] = await Promise.all([
        supabase
          .from("user_access")
          .select("*")
          .order("email", { ascending: true }),

        supabase
          .from("access_invites")
          .select(
            "id, email, created_by, status, expires_at, created_at, accepted_at",
          )
          .order("created_at", { ascending: false }),
      ]);

      if (accessResult.error || inviteResult.error) {
        console.error("Erro ao listar acessos:", {
          access: accessResult.error?.message,
          invites: inviteResult.error?.message,
        });
        return fail("Não foi possível carregar a lista de acessos.", 500);
      }

      return json({
        success: true,
        accesses: accessResult.data ?? [],
        invites: inviteResult.data ?? [],
      });
    }

    // CRIAR E ENVIAR CONVITE
    if (action === "invite") {
      const email = normalizeEmail(body.email);

      if (
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return fail("Informe um endereço de e-mail válido.");
      }

      if (isAdminEmail(email)) {
        return fail("A conta administradora inicial já possui acesso.");
      }

      const { data: existingInvite, error: duplicateError } =
        await supabase
          .from("access_invites")
          .select("id, status, expires_at")
          .eq("email", email)
          .eq("status", "pending")
          .maybeSingle();

      if (duplicateError) {
        console.error(
          "Erro ao verificar convite existente:",
          duplicateError.message,
        );
        return fail("Não foi possível verificar convites anteriores.", 500);
      }

      if (
        existingInvite &&
        new Date(existingInvite.expires_at).getTime() > Date.now()
      ) {
        return fail("Já existe um convite pendente para este e-mail.", 409);
      }

      const token = createToken();
      const tokenHash = await sha256(token);
      const expiresAt = new Date(
        Date.now() + INVITE_TTL_MS,
      ).toISOString();

      const { data: newInvite, error: insertError } = await supabase
        .from("access_invites")
        .insert({
          email,
          created_by: user.id,
          token_hash: tokenHash,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insertError || !newInvite) {
        console.error(
          "Erro ao gravar convite:",
          insertError?.message,
        );
        return fail("Não foi possível registrar o convite.", 500);
      }

      const redirectTo =
        `${APP_ORIGIN}/aceitar-convite?invite_token=${encodeURIComponent(token)}`;

      const { error: sendError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo,
        });

      if (sendError) {
        console.error("Erro ao enviar convite:", sendError.message);

        await supabase
          .from("access_invites")
          .delete()
          .eq("id", newInvite.id)
          .eq("status", "pending");

        return fail(
          "O convite não foi enviado. Verifique se o e-mail já possui uma conta e confira as configurações de e-mail do Supabase.",
          400,
        );
      }

      return json({
        success: true,
        message: "Convite enviado por e-mail.",
        invite: {
          id: newInvite.id,
          email,
          status: "pending",
          expires_at: expiresAt,
        },
      });
    }

    // APROVAR OU ALTERAR O STATUS DO ACESSO
    if (action === "set_access" || action === "set_status") {
      const targetUserId =
        typeof body.user_id === "string" ? body.user_id.trim() : "";
      const targetEmail = normalizeEmail(body.email);

      if (!targetUserId && !targetEmail) {
        return fail("Informe user_id ou e-mail do usuário.");
      }

      const { data: target, error: targetError } = await supabase
        .from("user_access")
        .select("user_id, email, role, status")
        .match(
          targetUserId
            ? { user_id: targetUserId }
            : { email: targetEmail },
        )
        .maybeSingle();

      if (targetError) {
        console.error("Erro ao consultar usuário:", targetError.message);
        return fail("Não foi possível consultar o acesso.", 500);
      }

      if (!target) {
        return fail("Usuário não encontrado na tabela de acessos.", 404);
      }

      if (isAdminEmail(normalizeEmail(target.email))) {
        return fail(
          "A conta administradora inicial não pode ser alterada por esta ação.",
          403,
        );
      }

      const updates: Record<string, string> = {};

      if (action === "set_access") {
        const role =
          typeof body.role === "string" ? body.role.trim() : "";

        if (!["professional", "admin"].includes(role)) {
          return fail("Função inválida.");
        }

        updates.role = role;
      }

      if (action === "set_status") {
        const status =
          typeof body.status === "string" ? body.status.trim() : "";

        if (!["approved", "pending", "blocked"].includes(status)) {
          return fail("Status inválido.");
        }

        updates.status = status;
      }

      const { error: updateError } = await supabase
        .from("user_access")
        .update(updates)
        .eq("user_id", target.user_id);

      if (updateError) {
        console.error("Erro ao atualizar acesso:", updateError.message);
        return fail("Não foi possível atualizar o acesso.", 500);
      }

      return json({
        success: true,
        message: "Acesso atualizado.",
      });
    }

    // REVOGAR CONVITE PENDENTE
    if (action === "revoke") {
      const inviteId =
        typeof body.invite_id === "string" ? body.invite_id.trim() : "";
      const email = normalizeEmail(body.email);

      if (!inviteId && !email) {
        return fail("Informe invite_id ou e-mail do convite.");
      }

      let query = supabase
        .from("access_invites")
        .update({ status: "revoked" })
        .eq("status", "pending");

      query = inviteId
        ? query.eq("id", inviteId)
        : query.eq("email", email);

      const { data: revoked, error: revokeError } = await query
        .select("id, email, status");

      if (revokeError) {
        console.error("Erro ao revogar convite:", revokeError.message);
        return fail("Não foi possível revogar o convite.", 500);
      }

      if (!revoked?.length) {
        return fail("Nenhum convite pendente correspondente foi encontrado.", 404);
      }

      return json({
        success: true,
        message: "Convite revogado.",
        invites: revoked,
      });
    }

    return fail("Ação não reconhecida.", 400);
  } catch (error) {
    console.error(
      "Erro inesperado em manage-access:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );

    return fail("Erro interno ao processar a solicitação.", 500);
  }
});
