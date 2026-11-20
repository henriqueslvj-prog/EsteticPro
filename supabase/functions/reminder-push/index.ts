import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });
const dateKey = (d: Date) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const v = Object.fromEntries(p.map((x) => [x.type, x.value])); return `${v.year}-${v.month}-${v.day}`; };
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const sameMonthDay = (birth: string, date: string) => birth.slice(5,10) === date.slice(5,10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  const supplied = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") || "";
  const isCron = Boolean(cronSecret && supplied && supplied === cronSecret);
  if (!isCron && !auth.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@esteticpro.app";
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !cronSecret) {
    return json(500, { error: "Configuração incompleta. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REMINDER_CRON_SECRET e as três variáveis VAPID." });
  }
  if (!isCron) {
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anon) return json(500, { error: "SUPABASE_ANON_KEY ausente." });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return json(401, { error: "Sessão inválida." });
    return json(200, { ok: true, message: "Sessão válida. O disparo é reservado ao agendador." });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const today = dateKey(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Recife", weekday: "short" }).format(new Date());
  const weekly = weekday === "Mon";
  const results = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  const { data: subscriptions, error: subError } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth_secret");
  if (subError) return json(500, { error: subError.message });

  const userIds = [...new Set((subscriptions || []).map((s: any) => s.user_id))];
  for (const userId of userIds) {
    const subs = (subscriptions || []).filter((s: any) => s.user_id === userId);
    const [{ data: settings }, { data: clients }, { data: appointments }] = await Promise.all([
      db.from("user_settings").select("reminders_enabled,appointment_reminder_day_before,appointment_reminder_day_of,birthday_reminder_day_before,birthday_reminder_day_of,birthday_weekly_summary").eq("user_id", userId).maybeSingle(),
      db.from("clients").select("id,full_name,birth_date,active").eq("user_id", userId).not("birth_date", "is", null),
      db.from("appointments").select("id,appointment_date,start_time,status,procedure_name,client_id,clients(full_name)").eq("user_id", userId).in("appointment_date", [today, tomorrow]).not("status", "in", '("Cancelado","Faltou")'),
    ]);
    if (settings?.reminders_enabled === false) continue;
    const jobs: Array<{key:string,type:string,date:string,title:string,body:string}> = [];
    for (const a of appointments || []) {
      const isTomorrow = a.appointment_date === tomorrow;
      const type = isTomorrow ? "appointment_day_before" : "appointment_day_of";
      if (isTomorrow && settings?.appointment_reminder_day_before === false) continue;
      if (!isTomorrow && settings?.appointment_reminder_day_of === false) continue;
      const clientName = (a as any).clients?.full_name || "Cliente";
      jobs.push({ key: a.id, type, date: today, title: isTomorrow ? "Atendimento amanhã" : "Atendimento hoje", body: `${clientName} · ${String(a.start_time || "").slice(0,5)} · ${a.procedure_name || "Atendimento"}` });
    }
    for (const c of clients || []) {
      if (c.active === false) continue;
      const birthday = String(c.birth_date).slice(5,10);
      if (sameMonthDay(String(c.birth_date), tomorrow) && settings?.birthday_reminder_day_before !== false) {
        jobs.push({ key: c.id, type: "birthday_day_before", date: today, title: "Aniversário amanhã 🎂", body: `Amanhã é aniversário de ${c.full_name}. Prepare sua mensagem!` });
      }
      if (sameMonthDay(String(c.birth_date), today) && settings?.birthday_reminder_day_of !== false) {
        jobs.push({ key: c.id, type: "birthday_day_of", date: today, title: "Aniversário hoje 🎂", body: `Hoje é aniversário de ${c.full_name}. Envie uma mensagem especial!` });
      }
    }
    if (weekly && settings?.birthday_weekly_summary !== false) {
      const upcoming = (clients || []).filter((c: any) => c.active !== false && [0,1,2,3,4,5,6].some((n) => sameMonthDay(String(c.birth_date), addDays(today,n))));
      if (upcoming.length) jobs.push({ key: `week:${today}`, type: "birthday_weekly_summary", date: today, title: "Aniversários da semana 🎂", body: upcoming.slice(0,5).map((c: any)=>c.full_name).join(", ") + (upcoming.length>5 ? ` e mais ${upcoming.length-5}` : "") });
    }
    for (const job of jobs) {
      results.scanned++;
      const { data: existing } = await db.from("reminder_delivery_logs").select("id,status").eq("user_id", userId).eq("reminder_key", job.key).eq("reminder_type", job.type).eq("scheduled_for", job.date).eq("delivery_channel", "push").maybeSingle();
      if (existing?.status === "delivered") { results.skipped++; continue; }
      let logId = existing?.id;
      if (!logId) {
        const { data: inserted, error: insertError } = await db.from("reminder_delivery_logs").insert({ user_id: userId, reminder_key: job.key, reminder_type: job.type, scheduled_for: job.date, delivery_channel: "push", status: "pending" }).select("id").single();
        if (insertError) { results.failed++; continue; }
        logId = inserted.id;
      }
      let sentToAny = false;
      const errors: string[] = [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, JSON.stringify({ title: job.title, body: job.body, url: "/?open=lembretes", tag: `esteticpro-${job.type}-${job.key}-${job.date}` }), { TTL: 60 * 60 * 24 });
          sentToAny = true;
        } catch (e) {
          const err = e as any;
          errors.push(String(err?.message || e));
          if (err?.statusCode === 404 || err?.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
      await db.from("reminder_delivery_logs").update({ status: sentToAny ? "delivered" : "failed", delivered_at: sentToAny ? new Date().toISOString() : null, error_message: errors.join("; ").slice(0,1500) || null }).eq("id", logId);
      if (sentToAny) results.sent++; else results.failed++;
    }
  }
  return json(200, { ok: true, date: today, ...results });
});
