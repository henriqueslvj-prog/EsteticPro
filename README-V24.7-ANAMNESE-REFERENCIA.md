# EsteticPro V24.7 — Anamnese baseada na ficha de referência

## Atualização
A ficha de anamnese digital foi reorganizada com base no PDF de referência enviado pelo usuário.

### Estrutura
- Informações iniciais
- Hábitos diários
- Histórico clínico
- Avaliação facial
- Cuidados e conduta profissional (mantido)
- Declaração e ciência (mantido)

### Incluído
- Campos de hábitos, rotina de skincare, exposição solar, protetor solar, tabagismo, álcool, sono, água, alimentação e atividade física.
- Histórico clínico, anticoncepcional, menstruação, gestação, exames, tratamento médico, medicamentos, cicatrização, alterações psicológicas/psiquiátricas, epilepsia, estresse, antecedentes oncológicos e problemas de saúde.
- Avaliação facial com biotipo, hidratação, poros, acne, fotoenvelhecimento, rugas, flacidez, alterações vasculares, olheiras, edema, equimose, hemangioma/nevo, eritema, pigmentação, cicatrizes, lesões, pelos, fototipo, rosácea e poiquilodermina.
- Textos explicativos do PDF para fotoenvelhecimento, tipos de olheiras, fototipos, subtipos de rosácea e poiquilodermina.
- PDF de anamnese atualizado com todos os campos e seções.
- Histórico de versões continua utilizando a tabela `client_anamneses`; não é necessária nova tabela SQL porque os campos continuam armazenados no JSONB `answers`.

## Fonte
Conteúdo baseado no arquivo de referência `minha ficha de anamnese.pdf` fornecido pelo usuário.
