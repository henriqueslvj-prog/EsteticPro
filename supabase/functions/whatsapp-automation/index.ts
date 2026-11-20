import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-esteticpro-automation-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const configuredSecret = Deno.env.get("WHATSAPP_AUTOMATION_SECRET");
  const suppliedSecret = req.headers.get("x-esteticpro-automation-secret");
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return json({ error: "Automação não autorizada." }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION");
    const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
    const reminderTemplateName = Deno.env.get("WHATSAPP_REMINDER_TEMPLATE_NAME") || templateName;
    const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";
    if (!supabaseUrl || !secretKeysRaw || !accessToken || !phoneNumberId || !graphVersion || !templateName || !reminderTemplateName) {
      return json({ error: "Configure SUPABASE_SECRET_KEYS, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION e WHATSAPP_TEMPLATE_NAME." }, 503);
    }

    const secretKeys = JSON.parse(secretKeysRaw);
    const secretKey = secretKeys.default;
    if (!secretKey) return json({ error: "SUPABASE_SECRET_KEYS sem chave default." }, 500);

    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const now = new Date();

    const { data: users, error: usersError } = await admin
      .from("user_settings")
      .select("user_id, whatsapp_automation_enabled, whatsapp_auto_reminder, whatsapp_reminder_hours")
      .eq("whatsapp_automation_enabled", true)
      .eq("whatsapp_auto_reminder", true);
    if (usersError) throw usersError;

    let processed = 0;
    for (const settings of users || []) {
      const hours = Number(settings.whatsapp_reminder_hours || 24);
      const from = new Date(now.getTime() + Math.max(0, hours - 1) * 60 * 60 * 1000);
      const to = new Date(now.getTime() + (hours + 1) * 60 * 60 * 1000);
      const localDateFrom = toLocalDate(from);
      const localDateTo = toLocalDate(to);

      const { data: appointments, error: apptError } = await admin
        .from("appointments")
        .select("id,user_id,client_id,appointment_date,start_time,procedure_name,status,clients(full_name,phone)")
        .eq("user_id", settings.user_id)
        .gte("appointment_date", localDateFrom)
        .lte("appointment_date", localDateTo)
        .in("status", ["Agendado", "Confirmado", "Aguardando"]);
      if (apptError) throw apptError;

      for (const appointment of appointments || []) {
        const client = appointment.clients;
        if (!client?.phone) continue;
        const appointmentAt = new Date(`${appointment.appointment_date}T${String(appointment.start_time).slice(0,5)}:00-03:00`);
        const diff = (appointmentAt.getTime() - now.getTime()) / 3600000;
        if (diff < hours - 1 || diff > hours + 1) continue;

        const { data: existing } = await admin.from("whatsapp_automation_logs").select("id").eq("appointment_id", appointment.id).eq("automation_type", "lembrete").maybeSingle();
        if (existing) continue;

        const toPhone = normalizeBrazilPhone(client.phone);
        if (!toPhone) continue;
        const firstName = String(client.full_name || "").trim().split(/\s+/)[0] || "Olá";
        const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(appointmentAt);
        const time = String(appointment.start_time).slice(0,5);
        const procedure = appointment.procedure_name || "atendimento";
        const payload = {
          messaging_product: "whatsapp",
          to: toPhone,
          type: "template",
          template: {
            name: reminderTemplateName,
            language: { code: templateLanguage },
            components: [{ type: "body", parameters: [
              { type: "text", text: firstName },
              { type: "text", text: date },
              { type: "text", text: time },
              { type: "text", text: procedure },
            ] }],
          },
        };
        const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (response.ok) {
          await admin.from("whatsapp_automation_logs").insert({ user_id: settings.user_id, appointment_id: appointment.id, automation_type: "lembrete", status: "enviado", message_id: result?.messages?.[0]?.id || null });
          processed++;
        } else {
          await admin.from("whatsapp_automation_logs").insert({ user_id: settings.user_id, appointment_id: appointment.id, automation_type: "lembrete", status: "erro", error_message: result?.error?.message || "Falha no WhatsApp." });
        }
      }
    }

    return json({ ok: true, processed, checked_at: now.toISOString() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado na automação." }, 500);
  }
});

function normalizeBrazilPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : null;
}
function toLocalDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
