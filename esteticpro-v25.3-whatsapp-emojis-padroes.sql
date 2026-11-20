-- EsteticPro V25.3 — corrige/garante modelos padrão para todos os profissionais.
-- Mantém modelos personalizados existentes; preenche apenas modelos ausentes/vazios.

alter table public.business_settings
  add column if not exists whatsapp_message_templates jsonb not null default '{
    "confirmacao": "Olá, {nome_cliente}! 💚 Seu agendamento de {procedimento} está confirmado para o dia {data} às {horario}. Será um prazer receber você! Se precisar alterar o horário, é só me chamar por aqui.",
    "lembrete": "Olá, {nome_cliente}! 🌿 Passando para lembrar do seu atendimento de {procedimento} no dia {data} às {horario}. Está tudo certo para você? Aguardo sua confirmação! 💚",
    "pos_atendimento": "Olá, {nome_cliente}! 💚 Foi um prazer cuidar de você hoje. Não se esqueça de seguir as orientações e os cuidados recomendados para sua pele. Qualquer dúvida, estou à disposição!",
    "retorno": "Olá, {nome_cliente}! 💚 Tudo bem? Estou passando para saber como está sua pele e verificar se já podemos programar seu próximo atendimento. Se quiser, podemos encontrar um horário que fique bom para você!",
    "reagendamento": "Olá, {nome_cliente}! 💚 Sem problemas! Vamos encontrar outro horário para seu atendimento. Me diga qual dia e período ficam melhores para você, e verificamos a disponibilidade.",
    "localizacao": "Olá, {nome_cliente}! 💚 Para facilitar sua chegada, estou enviando a localização do nosso espaço: {localizacao}. Qualquer dificuldade para encontrar o endereço, pode me chamar!"
  }'::jsonb;

update public.business_settings
set whatsapp_message_templates =
  coalesce(whatsapp_message_templates, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'confirmacao', coalesce(nullif(whatsapp_message_templates->>'confirmacao',''), 'Olá, {nome_cliente}! 💚 Seu agendamento de {procedimento} está confirmado para o dia {data} às {horario}. Será um prazer receber você! Se precisar alterar o horário, é só me chamar por aqui.'),
    'lembrete', coalesce(nullif(whatsapp_message_templates->>'lembrete',''), 'Olá, {nome_cliente}! 🌿 Passando para lembrar do seu atendimento de {procedimento} no dia {data} às {horario}. Está tudo certo para você? Aguardo sua confirmação! 💚'),
    'pos_atendimento', coalesce(nullif(whatsapp_message_templates->>'pos_atendimento',''), 'Olá, {nome_cliente}! 💚 Foi um prazer cuidar de você hoje. Não se esqueça de seguir as orientações e os cuidados recomendados para sua pele. Qualquer dúvida, estou à disposição!'),
    'retorno', coalesce(nullif(whatsapp_message_templates->>'retorno',''), 'Olá, {nome_cliente}! 💚 Tudo bem? Estou passando para saber como está sua pele e verificar se já podemos programar seu próximo atendimento. Se quiser, podemos encontrar um horário que fique bom para você!'),
    'reagendamento', coalesce(nullif(whatsapp_message_templates->>'reagendamento',''), 'Olá, {nome_cliente}! 💚 Sem problemas! Vamos encontrar outro horário para seu atendimento. Me diga qual dia e período ficam melhores para você, e verificamos a disponibilidade.'),
    'localizacao', coalesce(nullif(whatsapp_message_templates->>'localizacao',''), 'Olá, {nome_cliente}! 💚 Para facilitar sua chegada, estou enviando a localização do nosso espaço: {localizacao}. Qualquer dificuldade para encontrar o endereço, pode me chamar!')
  )),
  updated_at = now()
where whatsapp_message_templates is null
   or jsonb_typeof(whatsapp_message_templates) <> 'object'
   or not (whatsapp_message_templates ?& array['confirmacao','lembrete','pos_atendimento','retorno','reagendamento','localizacao']);

notify pgrst, 'reload schema';
