import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso | Shinã",
  description: "Termos de uso da plataforma Shinã (Shinã e Shinã Marketing IA).",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-base leading-none">S</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Shinã
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Termos de Uso</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Última atualização: agosto de 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section>
            <p>
              Estes Termos de Uso (&quot;Termos&quot;) regem o acesso e uso da plataforma Shinã,
              incluindo o produto de gestão operacional de frotas e ativos (&quot;Shinã&quot;) e o
              produto de marketing com inteligência artificial (&quot;Shinã Marketing IA&quot;),
              disponibilizados nos domínios <em>shinaia.com.br</em>, <em>app.shinaia.com.br</em> e{" "}
              <em>mkt.shinaia.com.br</em>, além dos aplicativos móveis correspondentes. Ao criar uma
              conta ou usar qualquer parte da plataforma, você concorda com estes Termos e com a{" "}
              <a href="/privacidade" className="text-blue-600 dark:text-blue-400 underline">
                Política de Privacidade
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              1. Quem somos
            </h2>
            <p>
              A Shinã opera uma plataforma de software como serviço (SaaS) para empresas
              (&quot;tenants&quot;) que gerenciam frotas, ativos, contratos e operações, e um
              produto separado de marketing com IA para criação e gestão de campanhas publicitárias.
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              <a
                href="mailto:contato@shinaia.com.br"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                contato@shinaia.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              2. Contas e elegibilidade
            </h2>
            <p>
              Para usar a plataforma você precisa criar uma conta, via e-mail/senha, link mágico ou
              login social (Google, Apple, conforme disponível em cada produto). Você é responsável
              por manter a confidencialidade das suas credenciais e por todas as atividades
              realizadas na sua conta. A plataforma não é direcionada a menores de 18 anos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              3. Planos, cobrança e cancelamento
            </h2>
            <p>
              Alguns produtos e recursos são pagos, cobrados por assinatura recorrente através do
              nosso processador de pagamentos (Stripe). Onde aplicável (ex.: Shinã Marketing IA),
              oferecemos garantia de reembolso integral se o cancelamento ocorrer dentro de 14 dias
              corridos da contratação. Após esse período, cancelamentos interrompem cobranças
              futuras, sem reembolso proporcional do ciclo já em curso, salvo disposição legal em
              contrário. Preços e planos podem ser alterados mediante aviso prévio; a alteração não
              afeta o ciclo de cobrança já pago.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              4. Uso aceitável
            </h2>
            <p>Ao usar a plataforma, você concorda em não:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                Violar leis aplicáveis, incluindo legislação de proteção de dados e consumidor;
              </li>
              <li>
                Tentar acessar dados, contas ou tenants de terceiros sem autorização, ou burlar
                controles de isolamento e permissão da plataforma;
              </li>
              <li>
                Usar a plataforma para enviar spam, conteúdo enganoso, ou anúncios que violem as
                políticas das plataformas de publicidade integradas (Meta, Google, TikTok,
                LinkedIn);
              </li>
              <li>Fazer engenharia reversa, copiar ou revender a plataforma sem autorização;</li>
              <li>Interferir na operação, segurança ou disponibilidade dos serviços.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              5. Conteúdo e ações geradas por IA
            </h2>
            <p>
              O Shinã Marketing IA usa modelos de inteligência artificial para gerar sugestões de
              anúncios, textos e análises. Toda ação que afeta uma plataforma de anúncios externa
              (Meta, Google Ads, TikTok, LinkedIn) exige aprovação humana explícita antes de ser
              publicada — a IA nunca publica ou altera campanhas de forma autônoma. Você é
              responsável por revisar e aprovar o conteúdo gerado antes de publicá-lo, incluindo sua
              conformidade com marcas registradas, direitos autorais e as políticas de cada
              plataforma de anúncios.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              6. Integrações com terceiros
            </h2>
            <p>
              A plataforma pode se conectar a serviços de terceiros (Meta, Google, TikTok, LinkedIn,
              Stripe, entre outros) mediante sua autorização explícita (OAuth). Essas integrações
              estão sujeitas também aos termos de uso de cada terceiro. Você pode revogar o acesso a
              qualquer momento pelas configurações da sua conta ou diretamente no painel do
              provedor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              7. Propriedade intelectual
            </h2>
            <p>
              A plataforma, seu código, design e marca são de propriedade da Shinã. Você mantém
              titularidade sobre os dados e conteúdos que insere na plataforma (ex.: informações de
              frota, brand kits, criativos de anúncio), e nos concede licença limitada para
              processá-los exclusivamente para prestar o serviço contratado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              8. Disponibilidade e limitação de responsabilidade
            </h2>
            <p>
              Envidamos esforços razoáveis para manter a plataforma disponível, mas não garantimos
              operação ininterrupta ou livre de erros. Na máxima extensão permitida por lei, a Shinã
              não se responsabiliza por danos indiretos, lucros cessantes, ou perdas decorrentes de
              decisões tomadas com base em conteúdo gerado por IA sem a devida revisão humana.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              9. Encerramento
            </h2>
            <p>
              Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas
              que violem estes Termos, mediante aviso quando razoavelmente possível. Dados são
              tratados conforme nossa{" "}
              <a href="/privacidade" className="text-blue-600 dark:text-blue-400 underline">
                Política de Privacidade
              </a>{" "}
              após o encerramento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              10. Alterações destes Termos
            </h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Alterações materiais serão comunicadas
              pelos canais habituais da plataforma antes de entrarem em vigor. O uso continuado após
              a alteração constitui aceite dos novos Termos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              11. Legislação aplicável
            </h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
              foro do domicílio do usuário para dirimir eventuais controvérsias, salvo disposição
              legal em contrário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              12. Contato
            </h2>
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a
                href="mailto:contato@shinaia.com.br"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                contato@shinaia.com.br
              </a>
              . Dúvidas sobre privacidade e dados pessoais:{" "}
              <a
                href="mailto:privacidade@shinaia.com.br"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                privacidade@shinaia.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
