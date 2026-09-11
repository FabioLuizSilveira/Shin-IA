-- WAVE 3 follow-up -- platform-tenant master contract v3.
--
-- Fills the SLA section (ANEXO III) with PROVISIONAL market-standard values
-- for a mid-market B2B SaaS, explicitly marked "(a validar)" in the text
-- itself -- legal/ops sign-off is still pending before this SLA is a real
-- commitment. Everything else stays exactly as v2 (still has [PREENCHER]
-- for SHINA CNPJ/sede -- those are real facts, not guessable, and are left
-- untouched pending the actual data). This is a material change (new SLA
-- language) so existing acceptances of v2 (if any) must reaccept.

update contract_versions set status = 'superseded'
where id = '6b21694f-1c45-40ca-81d4-fc98b02bf5d9' and status = 'published';

with v as (
  select $contract$CONTRATO-MESTRE DE ACESSO E USO DA PLATAFORMA SHINÃ
Plataforma Shinã × Tenant | com Termo Específico Shinã Autoloc

Pelo presente instrumento particular, de um lado, SHINÃ INOVAÇÕES EM IA LTDA., CNPJ nº [PREENCHER], com sede em [PREENCHER], doravante "SHINÃ" ou "CONTRATADA"; e, de outro, [RAZÃO SOCIAL DO TENANT], CNPJ nº [PREENCHER], com sede em [PREENCHER], doravante "TENANT" ou "CONTRATANTE"; em conjunto, "Partes", celebram este Contrato-Mestre.

NOTA: Este documento é um modelo-base B2B e deve ser revisado por advogado habilitado antes de uso em produção, especialmente quanto a LGPD, responsabilidade civil, tributação, trânsito, locação, rastreamento, assinatura eletrônica, IA e integrações oficiais.

1. DEFINIÇÕES E ESTRUTURA CONTRATUAL

1.1. "Plataforma Shinã" significa a solução tecnológica SaaS, multi-tenant, de gestão, automação e inteligência operacional; "Tenant" é a organização contratante; "Pedido Comercial" define plano, módulos, limites, preços e condições comerciais; "DPA" é o Acordo de Tratamento de Dados Pessoais; "SLA" é o Acordo de Nível de Serviço; "Política de IA" disciplina IA, Shinã AI Credits e BYOK; e "Termo Específico" disciplina vertical, módulo, integração, white-label ou serviço que exija condições próprias.

1.2. Integram o acordo: este Contrato-Mestre, Pedidos Comerciais, DPA, SLA, Política de IA, Termos Específicos e demais documentos expressamente incorporados.

1.3. Em conflito, prevalecerá: (i) alteração assinada; (ii) Pedido Comercial; (iii) DPA, para matéria de proteção de dados; (iv) Termo Específico, para matéria própria da vertical ou módulo; (v) SLA; (vi) Política de IA; (vii) este Contrato-Mestre; e (viii) políticas gerais.

1.4. O TENANT aceita o Contrato-Mestre uma única vez. A contratação posterior de módulos ou extensões poderá ocorrer por novo Pedido Comercial ou aditivo eletrônico, sem necessidade de nova assinatura das condições gerais, salvo alteração material ou Termo Específico exigível.

2. OBJETO E LICENÇA DE ACESSO

2.1. Este Contrato regula o acesso e uso da Plataforma Shinã e dos módulos, extensões, integrações, APIs, aplicativos e serviços expressamente abrangidos pelo Pedido Comercial.

2.2. O TENANT recebe direito de acesso limitado, não exclusivo, não sublicenciável e intransferível durante a vigência. Não adquire propriedade sobre software, código-fonte, modelos, APIs, design system, documentação, marcas, algoritmos, arquitetura ou know-how da SHINÃ.

2.3. Implantação, migração, parametrização, customização, desenvolvimento, treinamento ou consultoria dependem de contratação específica quando não incluídos no plano.

3. AMBIENTE MULTI-TENANT, USUÁRIOS E AUTORIZAÇÃO

3.1. O TENANT possui ambiente lógico próprio, com usuários, permissões, configurações, dados, identidade visual e funcionalidades vinculadas ao plano.

3.2. O TENANT administra seus usuários, perfis, filiais, papéis e permissões. A SHINÃ adotará controles técnicos e organizacionais proporcionais ao risco para preservar o isolamento lógico entre tenants.

3.3. É vedado tentar acessar dados de outro tenant, contornar autenticação ou autorização, explorar vulnerabilidades, praticar engenharia reversa ilícita ou usar a Plataforma para finalidade ilegal.

3.4. Recursos de IA e automação operam dentro da autorização do usuário e não ampliam suas permissões.

4. PLANOS, MÓDULOS, ENTITLEMENTS E BETA

4.1. Recursos disponíveis serão definidos pelo Pedido Comercial, módulos contratados, limites, entitlements e feature flags.

4.2. Módulos podem ser ativados ou desativados conforme disponibilidade técnica, comercial e regulatória.

4.3. Recursos beta, experimentais ou de acesso antecipado podem ter condições próprias, inclusive ausência de SLA e garantia de continuidade.

5. PREÇO, FATURAMENTO, PAGAMENTO E EXCEDENTES

5.1. O TENANT pagará os valores do Pedido Comercial, acrescidos dos tributos aplicáveis.

5.2. Excedentes e serviços variáveis - inclusive usuários, ativos, armazenamento, mensagens, assinatura eletrônica, rastreamento, integrações, IA e terceiros - poderão ser cobrados quando previstos.

5.3. O atraso poderá gerar correção monetária, juros de mora de 1% ao mês e multa de até 2%, sem prejuízo de suspensão conforme este Contrato.

5.4. Cobranças variáveis poderão ser contestadas em até 10 dias corridos após a disponibilização da fatura ou relatório; valores não controvertidos permanecem exigíveis.

5.5. O Pedido Comercial indicará franquias, excedentes, método de medição, hard budget, reajuste, renovação, permanência mínima e condições de rescisão, quando aplicáveis.

6. SHINÃ AI CREDITS, MEDIÇÃO E TRANSPARÊNCIA

6.1. Recursos de IA podem ser medidos e cobrados por "Shinã AI Credits", unidade comercial de consumo de IA, voz, documentos e recursos correlatos.

6.2. Salvo condição diversa no Pedido Comercial, 1 Shinã AI Credit corresponde a R$ 0,01 de valor comercial. Alterações prospectivas serão comunicadas e não alterarão lançamentos já realizados.

6.3. O consumo será apurado por critérios objetivos de medição e precificação vigentes, considerando recursos computacionais utilizados, modalidade da operação e tabela ou política aplicável ao plano. A metodologia interna de custos, fornecedores, margens e roteamento de modelos constitui informação comercial e técnica da SHINÃ.

6.4. A Plataforma disponibilizará ao TENANT demonstrativo de consumo contendo, no mínimo, saldo disponível, créditos concedidos ou adquiridos, consumo no período e histórico de lançamentos, conforme as funcionalidades do plano.

6.5. Quando tecnicamente aplicável, poderão ser exibidos detalhes técnicos complementares, como tokens de entrada, tokens em cache, tokens de saída, duração de voz e outras unidades de processamento. Tais métricas não substituem o Shinã AI Credit como unidade comercial.

6.6. Ao atingir saldo ou hard budget, operações pagas de IA poderão ser interrompidas até recarga, renovação ou ampliação da franquia. Não haverá excedente automático silencioso salvo autorização comercial expressa.

6.7. Operações tecnicamente falhas e sem resultado utilizável não consumirão créditos, salvo processamento efetivamente concluído cuja falha seja exclusivamente de entrega ou hipótese objetiva prevista na Política de IA.

7. INTELIGÊNCIA ARTIFICIAL, SHINÃ E BYOK

7.1. A Plataforma poderá disponibilizar a Shinã, agente operacional do ambiente do TENANT, para consultas, organização, análise e, quando autorizado, execução assistida de ações.

7.2. Resultados de IA podem conter erros, omissões ou interpretações inadequadas. O TENANT deverá manter revisão humana em decisões financeiras, jurídicas, fiscais, trabalhistas, de segurança, manutenção crítica e demais contextos de alto impacto.

7.3. Funcionalidades poderão usar credenciais gerenciadas pela SHINÃ ou credenciais do TENANT ("BYOK"), quando disponíveis. Em BYOK, o TENANT responde pela contratação, habilitação, limites e custos do fornecedor correspondente.

7.4. Automações que enviem comunicações, alterem registros, efetuem cobranças, solicitem assinaturas ou produzam efeitos perante terceiros dependerão das permissões, políticas de risco, confirmações e, quando aplicável, autenticação reforçada.

7.5. Dados privados e identificáveis do TENANT não serão utilizados pela SHINÃ para treinamento de modelos fundacionais de terceiros. Logs técnicos, avaliações, telemetria e estatísticas agregadas ou anonimizadas poderão ser utilizados para segurança, qualidade e melhoria do produto nos limites legais.

8. DADOS PESSOAIS E LGPD

8.1. As Partes tratarão dados pessoais conforme a Lei nº 13.709/2018 e normas aplicáveis.

8.2. Para dados tratados exclusivamente em nome e conforme instruções documentadas do TENANT, este será, em regra, Controlador e a SHINÃ, Operadora, ressalvadas atividades em que cada Parte atue como Controladora independente.

8.3. O TENANT declara possuir base legal para inserir, importar, compartilhar e determinar o tratamento de dados pessoais na Plataforma.

8.4. O tratamento é detalhado no Anexo II - DPA.

9. SEGURANÇA, CONTINUIDADE E BACKUP

9.1. A SHINÃ adotará medidas técnicas e administrativas proporcionais ao risco, incluindo controles de acesso, segregação lógica, autenticação, autorização, auditoria, criptografia quando aplicável, monitoramento e desenvolvimento seguro.

9.2. O TENANT é responsável por proteger credenciais, dispositivos, redes e acessos de seus usuários e por comunicar suspeitas de comprometimento.

9.3. Operações sensíveis poderão exigir MFA ou autenticação reforçada.

9.4. Backup e recuperação observarão a natureza do serviço; RPO e RTO, quando contratados, constarão do SLA.

10. INTEGRAÇÕES E SERVIÇOS DE TERCEIROS

10.1. A Plataforma poderá integrar ERPs, CRMs, rastreadores, mensageria, assinatura eletrônica, pagamentos, órgãos públicos e provedores de IA.

10.2. Integrações podem depender de credenciais, autorizações, contratos, homologações, disponibilidade e políticas do terceiro.

10.3. A SHINÃ não responderá por falha exclusivamente imputável a terceiro, sem prejuízo de esforços razoáveis de mitigação quando a integração for essencial ao serviço contratado.

10.4. O TENANT fornecerá apenas credenciais, dados e autorizações que possua legitimidade para utilizar.

11. DADOS DE TRÂNSITO E INTEGRAÇÕES OFICIAIS

11.1. Consultas a SENATRAN, RENAINF, RENAVAM, DETRANs, órgãos autuadores ou prestadores oficiais dependem de autorizações, credenciamentos, contratos, anuências e requisitos técnicos e regulatórios vigentes.

11.2. Quando juridicamente aplicável, o TENANT autoriza o uso de seu CNPJ e dos dados estritamente necessários para identificação como anuente ou beneficiário perante entidades competentes.

11.3. O TENANT declara que veículos, contratos, condutores e referências submetidos à consulta estão sob sua gestão legítima ou possuem base jurídica adequada.

11.4. Dados oficiais serão utilizados apenas para finalidades autorizadas. É vedada consulta indiscriminada, enriquecimento ilegítimo de base ou comercialização de dados oficiais.

11.5. Suspensão, revogação, indisponibilidade oficial ou mudança regulatória poderá suspender a funcionalidade correspondente sem caracterizar inadimplemento da SHINÃ quando não lhe for imputável.

12. DADOS, CONTEÚDO E PROPRIEDADE INTELECTUAL

12.1. Dados e conteúdos legitimamente inseridos ou controlados pelo TENANT permanecem sob sua titularidade, ressalvados direitos de terceiros.

12.2. O TENANT concede à SHINÃ licença limitada para armazenar, processar, transmitir, indexar, transformar e exibir dados na medida necessária à prestação dos serviços.

12.3. A SHINÃ poderá utilizar logs técnicos, telemetria, métricas de performance e estatísticas agregadas ou anonimizadas para segurança, capacidade e melhoria do produto.

12.4. Modelos, regras genéricas, algoritmos, arquitetura, templates, know-how, módulos, marcas, interfaces e evoluções da Plataforma pertencem à SHINÃ ou seus licenciadores.

12.5. Uso da marca, nome, logotipo, depoimento ou resultados identificáveis do TENANT em material comercial requer autorização prévia e escrita.

13. DISPONIBILIDADE, SUPORTE E SERVIÇOS PROFISSIONAIS

13.1. A SHINÃ envidará esforços comercialmente razoáveis para manter a Plataforma disponível, observadas as exclusões e condições do SLA.

13.2. Atualizações de segurança, correções e melhorias poderão ser aplicadas sem aviso individual quando necessárias à proteção da Plataforma ou quando não reduzirem materialmente o serviço contratado.

13.3. Mudanças de escopo, prazo, integração, volume ou regra de negócio que excedam o contratado dependem de aprovação comercial.

14. OBRIGAÇÕES DO TENANT

14.1. O TENANT utilizará a Plataforma licitamente; manterá dados atualizados; obterá bases legais, autorizações e consentimentos exigíveis; administrará usuários; respeitará limites; não inserirá código malicioso; colaborará em incidentes; e cumprirá regras de integrações.

14.2. O TENANT responde pelas decisões empresariais, operacionais, financeiras, jurídicas ou de segurança tomadas a partir da Plataforma, sem prejuízo da responsabilidade legal da SHINÃ por seus próprios atos.

14.3. O TENANT declara conformidade com leis anticorrupção e antilavagem aplicáveis.

15. CONFIDENCIALIDADE

15.1. Cada Parte manterá sigilo sobre informações técnicas, comerciais, estratégicas, financeiras, de segurança, credenciais, dados de clientes e demais informações confidenciais da outra.

15.2. A obrigação não abrange informação comprovadamente pública sem violação, já conhecida legitimamente, recebida de terceiro sem dever de sigilo ou exigida por lei ou autoridade.

15.3. A confidencialidade sobreviverá ao término por 5 anos, sem prejuízo de prazo legal superior ou proteção de segredo comercial.

16. RESPONSABILIDADE E LIMITAÇÕES

16.1. Cada Parte responderá por danos diretos comprovadamente causados por descumprimento de suas obrigações, nos limites legais.

16.2. Salvo hipóteses em que a lei proíba limitação, a responsabilidade agregada da SHINÃ fica limitada ao total efetivamente pago pelo TENANT nos 12 meses anteriores ao evento que originou a reclamação.

16.3. Na máxima extensão permitida, a SHINÃ não responderá por lucros cessantes, danos indiretos, perda de oportunidade, decisões sem revisão humana, falhas exclusivamente de terceiros ou uso em desconformidade.

16.4. As limitações não se aplicam a dolo, violação deliberada de confidencialidade, infração de propriedade intelectual imputável à Parte ou hipóteses legalmente inderrogáveis.

17. SUSPENSÃO

17.1. A SHINÃ poderá suspender total ou parcialmente o acesso em caso de risco de segurança, fraude, uso ilícito, tentativa de acesso a outro tenant, inadimplemento relevante, determinação de autoridade, violação de limites ou proteção urgente do ambiente.

17.2. Quando possível e compatível com segurança, haverá notificação e oportunidade de regularização.

17.3. Em inadimplemento, a SHINÃ poderá conceder prazo de até 5 dias úteis para regularização e, após 30 dias de atraso não sanado, encerrar o acesso, preservadas obrigações legais de retenção.

18. VIGÊNCIA, RESCISÃO, TRIAL E EXPORTAÇÃO

18.1. O Contrato entra em vigor na assinatura, aceite eletrônico ou ativação e vigorará pelo prazo do Pedido Comercial, renovando-se conforme ali previsto.

18.2. Qualquer Parte poderá rescindir por inadimplemento material não sanado em 15 dias após notificação, salvo hipótese grave que justifique rescisão imediata.

18.3. Planos com prazo mínimo observarão regras de rescisão antecipada previstas no Pedido Comercial.

18.4. Trial, piloto ou avaliação poderão ter limites e retenção diferenciados e, salvo previsão contrária, não estarão sujeitos a SLA.

18.5. Durante a vigência e por 30 dias corridos após o término, o TENANT poderá solicitar exportação em formatos padrão disponíveis. Serviços especiais de migração poderão ser cobrados.

18.6. Após o prazo aplicável, dados poderão ser excluídos ou anonimizados conforme retenção e obrigações legais.

19. ALTERAÇÕES, COMUNICAÇÕES E DISPOSIÇÕES GERAIS

19.1. A SHINÃ poderá evoluir, modificar, substituir ou descontinuar funcionalidades desde que preserve substancialmente a finalidade do serviço contratado ou ofereça alternativa razoável.

19.2. Alterações materiais serão comunicadas com antecedência razoável quando exigível; mudanças necessárias por lei, segurança ou autoridade poderão ter efeito imediato.

19.3. Comunicações contratuais poderão ocorrer por e-mail cadastrado, painel ou outro canal formal.

19.4. A invalidade de uma disposição não afetará as demais. Cessão dependerá de anuência da outra Parte, exceto reorganização societária ou transferência a empresa do mesmo grupo com preservação das obrigações.

19.5. Este Contrato poderá ser assinado ou aceito eletronicamente conforme a legislação aplicável.

20. LEI APLICÁVEL E FORO

20.1. Este Contrato será regido pelas leis da República Federativa do Brasil.

20.2. Fica eleito o foro da Comarca de [CIDADE/UF DA SHINÃ], ressalvadas competências legais inderrogáveis.

[CIDADE], [DATA].

SHINÃ INOVAÇÕES EM IA LTDA. — Nome: [PREENCHER] | Cargo: [PREENCHER]
TENANT / CONTRATANTE — Nome: [PREENCHER] | Cargo: [PREENCHER]


ANEXO I - PEDIDO COMERCIAL / PLANO CONTRATADO

Plano: [PREENCHER]
Mensalidade / preço: R$ [PREENCHER]
Vigência: [PREENCHER]
Usuários incluídos: [PREENCHER]
Ativos incluídos: [PREENCHER]
Módulos incluídos: [PREENCHER]
Shinã AI Credits: [PREENCHER] créditos/mês
Armazenamento: [PREENCHER] GB
Mensagens: [PREENCHER]
Hard budget: [PREENCHER]
Suporte: [PREENCHER]
Renovação: [PREENCHER]
Reajuste: [PREENCHER]
Permanência mínima: [PREENCHER]
Multa de rescisão antecipada: [PREENCHER]
Setup / implantação: [PREENCHER]
Trial: [SIM/NÃO] - [PRAZO]

Tabela de excedentes: preencher no Pedido Comercial vigente, indicando franquia, preço unitário, método de medição e periodicidade para usuários, ativos, IA, armazenamento, mensageria, assinatura, rastreamento e outros serviços variáveis.


ANEXO II - DPA: ACORDO DE TRATAMENTO DE DADOS PESSOAIS

1. PAPÉIS E ESCOPO
Para dados tratados exclusivamente em nome e sob instruções do TENANT, este atuará, em regra, como Controlador e a SHINÃ como Operadora. Cada Parte poderá atuar como Controladora independente quando determinar finalidade e meios próprios de tratamento.

2. TITULARES, DADOS E FINALIDADES
Titulares podem incluir clientes, usuários, operadores, condutores, empregados, prestadores e terceiros. Dados podem incluir identificação, contato, dados profissionais, contratuais, operacionais, financeiros, localização, telemetria, documentos, acesso e dispositivo, na medida necessária às funcionalidades contratadas.

3. INSTRUÇÕES E SUBOPERADORES
A SHINÃ tratará dados conforme o Contrato e instruções documentadas. Poderá utilizar suboperadores de nuvem, banco de dados, autenticação, comunicação, rastreamento, assinatura eletrônica, IA e observabilidade, impondo obrigações adequadas de proteção e mantendo mecanismo de divulgação da lista aplicável.

4. TRANSFERÊNCIA INTERNACIONAL
Transferências internacionais observarão mecanismos jurídicos e salvaguardas aplicáveis, inclusive as exigências da LGPD e regulamentação da ANPD.

5. SEGURANÇA E INCIDENTES
A SHINÃ adotará medidas proporcionais ao risco. A Parte que tomar conhecimento de incidente relevante que possa afetar dados tratados comunicará a outra sem demora injustificada e, sempre que possível, em até 24 horas após confirmação razoável, com as informações então disponíveis.

6. DIREITOS, AUTORIDADE E COOPERAÇÃO
As Partes cooperarão, conforme suas responsabilidades, no atendimento de titulares, solicitações da ANPD e demais autoridades competentes.

7. RETENÇÃO, EXPORTAÇÃO E ELIMINAÇÃO
Ao término, os dados serão exportados, devolvidos, excluídos ou anonimizados conforme o Contrato, instruções válidas do TENANT, política de retenção e obrigações legais.

8. AUDITORIA
O TENANT poderá solicitar comprovação razoável de conformidade por relatórios, certificações ou auditoria proporcional, preservadas segurança, confidencialidade, segredos de outros tenants e continuidade operacional.

9. IA, LOGS E DADOS OFICIAIS
Dados privados e identificáveis do TENANT não serão utilizados pela SHINÃ para treinamento de modelos fundacionais de terceiros. Tratamentos envolvendo IA, geolocalização, telemetria e dados de órgãos oficiais observarão finalidade, minimização, autorização e controles aplicáveis.


ANEXO III - SLA E SUPORTE

Os níveis abaixo refletem parâmetros de mercado para SaaS B2B de porte equivalente e SÃO PROVISÓRIOS — pendentes de validação formal pelo jurídico e pela operação da SHINÃ antes do uso em produção. O SLA pode variar por plano.

Disponibilidade mensal: 99,5% (valor de mercado, a validar pelo jurídico)
P1 - Crítica: ex. indisponibilidade geral | 1ª resposta: 1 hora útil | atualização: a cada 2 horas úteis (a validar)
P2 - Alta: ex. módulo essencial indisponível | 1ª resposta: 4 horas úteis | atualização: a cada 8 horas úteis (a validar)
P3 - Média: ex. função com workaround | 1ª resposta: 1 dia útil | atualização: a cada 2 dias úteis (a validar)
P4 - Baixa: ex. dúvida/melhoria | 1ª resposta: 3 dias úteis | atualização: conforme priorização do backlog (a validar)
RPO: 24 horas (a validar)
RTO: 8 horas (a validar)
Horário de suporte: dias úteis, 9h às 18h (horário de Brasília) (a validar)
Manutenção programada: fora do horário comercial, com aviso prévio de 48 horas (a validar)
Créditos de serviço: não aplicável nesta fase (a validar)

Não serão computadas como indisponibilidade, conforme critérios do plano: manutenção programada, força maior, falhas exclusivamente de terceiros, conectividade ou ambiente do TENANT, uso fora das especificações e funcionalidades beta.


ANEXO IV - POLÍTICA DE IA E SHINÃ AI CREDITS

1. O consumo de IA será aferido por critérios objetivos aplicáveis ao plano e registrado em ledger de consumo.
2. Shinã AI Credits constituem unidade comercial; tokens, segundos de voz e outras unidades são métricas técnicas complementares.
3. O TENANT terá acesso ao saldo, consumo no período e histórico de lançamentos. Detalhamento técnico poderá ser disponibilizado conforme a funcionalidade.
4. Hard budget e limites impedirão consumo pago silencioso além do autorizado, salvo contratação expressa de excedentes.
5. BYOK, quando disponível, seguirá regras específicas de segurança e responsabilidade do fornecedor escolhido pelo TENANT.
6. Dados privados e identificáveis do TENANT não serão utilizados pela SHINÃ para treinamento de modelos fundacionais de terceiros.
7. A SHINÃ poderá alterar fornecedores, modelos e roteamento técnico sem alteração da unidade comercial, desde que preserve substancialmente a funcionalidade contratada e observe segurança e proteção de dados.


ANEXO V - TERMO DE ANUÊNCIA PARA INTEGRAÇÕES OFICIAIS

O TENANT declara ciência de que determinadas consultas dependem de credenciamento, autorização de caso de uso, anuência, contratação com prestadores oficiais e requisitos técnicos e legais.

CNPJ do Tenant: [PREENCHER]
Caso(s) de uso autorizado(s): [PREENCHER]
Base(s)/sistema(s): [RENAINF / RENAVAM / DETRAN / OUTRO]
Finalidade: [PREENCHER]
Data da anuência: [PREENCHER]
Status: [PENDENTE / AUTORIZADO / REVOGADO]

A anuência não autoriza consultas fora dos casos de uso aprovados, nem comercialização, enriquecimento indiscriminado ou acesso a dados sem base jurídica. O TENANT comunicará alteração de legitimidade ou revogação aplicável.


ANEXO VI - TERMO ESPECÍFICO SHINÃ AUTOLOC
Condições da vertical de locação de veículos

Este Termo Específico integra o Contrato-Mestre quando o Pedido Comercial incluir o módulo/vertical Shinã Autoloc. Permanecem aplicáveis todas as condições gerais do Contrato-Mestre, DPA, SLA, Política de IA e demais anexos.

1. ESCOPO AUTOLOC
1.1. Conforme o plano, o Shinã Autoloc poderá abranger cadastro de veículos e clientes, propostas, reservas, contratos de locação, check-in/check-out, vistoria digital, documentos, cobranças, comunicação, rastreamento, manutenção, infrações, relatórios, assinatura eletrônica e recursos de IA.
1.2. A ativação de cada funcionalidade depende dos módulos e entitlements contratados.

2. RESPONSABILIDADES OPERACIONAIS DO LOCADOR
2.1. O TENANT, na qualidade de locador ou gestor da operação, é responsável pela legitimidade, exatidão e atualização dos dados de clientes, condutores adicionais, veículos, contratos, documentos, multas e vistorias.
2.2. O TENANT responde pelas decisões de locar ou recusar locação, bloquear cliente, definir preços, seguros, franquias, cauções, condições de devolução e cobrar avarias, multas, combustível, diárias, taxas ou outros valores de sua operação.
2.3. A Plataforma poderá automatizar ou sugerir fluxos, mas a responsabilidade empresarial pelas políticas comerciais e critérios da locação permanece com o TENANT, sem prejuízo de falha imputável à SHINÃ.

3. CONTRATOS, VISTORIAS, EVIDÊNCIAS E ASSINATURAS
3.1. A Plataforma poderá auxiliar a criação, gestão, armazenamento, envio e coleta de contratos de locação, vistorias, fotos, laudos, evidências e assinaturas.
3.2. O TENANT é responsável pelo conteúdo jurídico e comercial de seus contratos, políticas, preços, seguros, franquias, multas, avarias e condições de devolução.
3.3. A SHINÃ atua como provedora tecnológica e não presta aconselhamento jurídico nem garante, por si só, a validade de cláusulas elaboradas pelo TENANT.
3.4. Assinatura eletrônica dependerá do provedor integrado, do tipo de documento e dos requisitos legais aplicáveis. Custos poderão ser incluídos no plano ou cobrados por uso.

4. RASTREAMENTO, GEOLOCALIZAÇÃO E TELEMETRIA
4.1. Quando contratado, o módulo poderá consolidar dados de provedores, dispositivos e integrações de rastreamento. Precisão, frequência, cobertura e continuidade também dependem de equipamento, conectividade e fornecedor.
4.2. O TENANT declara possuir base jurídica e autorizações adequadas para tratar localização, telemetria, condutores, clientes, veículos e operações.
4.3. A SHINÃ não responde por decisões de bloqueio, recuperação, abordagem, comunicação a autoridades, retenção de bens ou cobrança tomadas pelo TENANT com base em rastreamento, salvo responsabilidade legal por falha própria comprovada.

5. INFRAÇÕES, MULTAS E CONSULTAS OFICIAIS
5.1. O módulo poderá registrar, importar, conciliar e acompanhar infrações, multas, prazos e responsabilidades associadas aos veículos e contratos do TENANT.
5.2. Consultas oficiais observarão o Contrato-Mestre e o Anexo V, inclusive credenciamentos, anuências e casos de uso autorizados.
5.3. O TENANT é responsável por verificar a atribuição da infração ao cliente, condutor ou responsável, bem como por indicações de condutor, defesas, recursos, pagamentos, repasses e cobranças.
5.4. Alertas de prazo são ferramentas de apoio e não substituem a conferência do documento oficial ou obrigação legal do TENANT.

6. MANUTENÇÃO E DISPONIBILIDADE DO VEÍCULO
6.1. O módulo poderá auxiliar manutenção preventiva/corretiva, ordens de serviço, custos, disponibilidade e indicadores.
6.2. Recomendações, scores e análises de IA não substituem inspeção técnica, manual do fabricante, profissional habilitado ou decisão de segurança do TENANT.
6.3. O TENANT é responsável pela condição de circulação, manutenção e segurança dos veículos sob sua gestão.

7. COBRANÇAS E MEIOS DE PAGAMENTO
7.1. Quando houver integração de pagamentos, a SHINÃ atuará como camada tecnológica conforme o serviço contratado, sem se tornar instituição financeira ou parte da relação de locação, salvo previsão expressa em produto específico.
7.2. O TENANT é responsável pela legitimidade das cobranças, estornos, cauções, franquias, multas, avarias e demais valores lançados contra seus clientes.
7.3. Serviços de terceiros observarão seus próprios prazos, regras, tarifas e disponibilidade.

8. INTELIGÊNCIA ARTIFICIAL NO AUTOLOC
8.1. A Shinã poderá auxiliar consultas de disponibilidade, contratos, manutenção, infrações, vistorias e demais dados do ambiente do TENANT, sempre dentro das permissões do usuário.
8.2. Ações que alterem registros ou produzam efeitos perante terceiros observarão confirmação, autorização e política de risco aplicável.
8.3. Vistoria por voz ou IA poderá estruturar observações e achados, mas o TENANT deverá revisar e confirmar o conteúdo antes de sua consolidação quando exigido pela funcionalidade.

9. PREVALÊNCIA E VIGÊNCIA DO TERMO
9.1. Este Termo aplica-se enquanto o Shinã Autoloc estiver incluído no Pedido Comercial.
9.2. Em conflito específico sobre a operação Autoloc, este Termo prevalece sobre as condições gerais, sem afastar DPA, obrigações legais ou regras específicas de integração oficial.
9.3. A desativação do Autoloc não extingue o Contrato-Mestre se outros módulos permanecerem contratados.

[CIDADE], [DATA].

SHINÃ INOVAÇÕES EM IA LTDA. — Nome: [PREENCHER] | Cargo: [PREENCHER]
TENANT / LOCADOR — Nome: [PREENCHER] | Cargo: [PREENCHER]
$contract$::text as body
)
insert into contract_versions (
  id, contract_template_id, version, title, content, content_hash,
  material_change, effective_at, published_at, status
)
select
  gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 3,
  'Contrato-Mestre de Acesso e Uso da Plataforma Shinã',
  v.body, encode(sha256(v.body::bytea), 'hex'), true, now(), now(), 'published'
from v
where not exists (
  select 1 from contract_versions
  where contract_template_id = 'c0000000-0000-0000-0000-000000000001' and version = 3
);
