-- EsteticPro V25.1 — modelos de mensagens WhatsApp por profissional
-- Salva os seis modelos dentro do registro individual de business_settings.

alter table public.business_settings
  add column if not exists whatsapp_message_templates jsonb not null default '{
    "confirmacao": "Olá, {nome_cliente}! 💚 Seu agendamento de {procedimento} está confirmado para o dia {data} às {horario}. Será um prazer receber você! Se precisar alterar o horário, é só me chamar por aqui.",
    "lembrete": "Olá, {nome_cliente}! 🌿 Passando para lembrar do seu atendimento de {procedimento} no dia {data} às {horario}. Está tudo certo para você? Aguardo sua confirmação! 💚",
    "pos_atendimento": "Olá, {nome_cliente}! 💚 Foi um prazer cuidar de você hoje. Não se esqueça de seguir as orientações e os cuidados recomendados para sua pele. Qualquer dúvida, estou à disposição!",
    "retorno": "Olá, {nome_cliente}! 💚 Tudo bem? Estou passando para saber como está sua pele e verificar se já podemos programar seu próximo atendimento. Se quiser, podemos encontrar um horário que fique bom para você!",
    "reagendamento": "Olá, {nome_cliente}! 💚 Sem problemas! Vamos encontrar outro horário para seu atendimento. Me diga qual dia e período ficam melhores para você, e verificamos a disponibilidade.",
    "localizacao": "Olá, {nome_cliente}! 💚 Para facilitar sua chegada, estou enviando a localização do nosso espaço: {localizacao}. Qualquer dificuldade para encontrar o endereço, pode me chamar!"
  }'::jsonb;

notify pgrst, 'reload schema';
