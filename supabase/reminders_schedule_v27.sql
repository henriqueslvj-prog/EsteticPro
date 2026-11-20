-- EsteticPro V27 — configurar agendamento diário do Web Push
-- Execute APÓS implantar a Edge Function e salvar REMINDER_CRON_SECRET no Vault.
-- O valor em Vault deve ser exatamente igual ao secret configurado na Edge Function.
-- Agendamento diário às 09:00 no horário de Recife (12:00 UTC).
-- Troque o nome do job se já existir um job semelhante.

select vault.create_secret('COLOQUE_AQUI_O_MESMO_REMINDER_CRON_SECRET_DA_EDGE_FUNCTION', 'esteticpro_reminder_cron_secret', 'Token usado pelo cron para autenticar a Edge Function');

select cron.schedule(
  'esteticpro-reminder-push-daily',
  '0 12 * * *',
  $job$
  select net.http_post(
    url := 'https://siceqyfkqafjrwkcacin.supabase.co/functions/v1/reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'esteticpro_reminder_cron_secret'
        order by created_at desc limit 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $job$
);

-- Verificação do job:
-- select jobid, schedule, command, active from cron.job where jobname = 'esteticpro-reminder-push-daily';
-- Histórico:
-- select * from cron.job_run_details order by start_time desc limit 20;
-- Para substituir o job existente, primeiro rode:
-- select cron.unschedule(jobid) from cron.job where jobname = 'esteticpro-reminder-push-daily';
