import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | Shinã",
  description: "Como a Shinã coleta, usa e protege os dados dos usuários da plataforma.",
};

export default function PrivacyPage() {
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Política de Privacidade
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Última atualização: agosto de 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section>
            <p>
              Esta Política de Privacidade descreve como a Shinã coleta, usa, compartilha e protege
              dados pessoais ao operar a plataforma Shinã (aplicativos web e móvel), em conformidade
              com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              1. Quem somos
            </h2>
            <p>
              A Shinã é uma plataforma de inteligência operacional para gestão de frotas e ativos,
              usada por empresas locadoras (&quot;tenants&quot;) e pelos clientes dessas empresas.
              Para dúvidas sobre privacidade, entre em contato pelo e-mail{" "}
              <a
                href="mailto:privacidade@shinaia.com.br"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                privacidade@shinaia.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              2. Quais dados coletamos
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Dados de conta:</strong> nome, e-mail, telefone e, quando aplicável, dados
                de autenticação via Google, Apple ou link mágico por e-mail.
              </li>
              <li>
                <strong>Dados operacionais:</strong> locações, contratos, faturas, e informações
                sobre os ativos (veículos e equipamentos) vinculados à conta do tenant.
              </li>
              <li>
                <strong>Localização de frota:</strong> quando um tenant habilita o rastreamento,
                coordenadas de GPS dos ativos são coletadas para exibição em mapa e cercas virtuais
                — não coletamos localização do dispositivo pessoal do usuário.
              </li>
              <li>
                <strong>Dados de pagamento:</strong> processados diretamente pelo Stripe (cartão ou
                Pix). A Shinã não armazena números de cartão de crédito.
              </li>
              <li>
                <strong>Dados de uso:</strong> registros técnicos de acesso e atividade dentro da
                plataforma, usados para segurança e suporte.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              3. Como usamos os dados
            </h2>
            <p>
              Usamos os dados para operar a plataforma (gestão de locações, contratos, faturas e
              frota), processar pagamentos, enviar notificações relacionadas à conta (ex.:
              confirmação de pagamento, atualização de reserva) e cumprir obrigações legais e
              contratuais.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              4. Compartilhamento de dados
            </h2>
            <p>
              Não vendemos dados pessoais. Compartilhamos dados apenas com prestadores de serviço
              necessários à operação da plataforma — processamento de pagamentos (Stripe),
              infraestrutura e banco de dados (Supabase) e hospedagem (Vercel) — e quando exigido
              por lei.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              5. Retenção e segurança
            </h2>
            <p>
              Mantemos os dados pelo tempo necessário para prestar o serviço e cumprir obrigações
              legais. Adotamos medidas técnicas e organizacionais para proteger os dados contra
              acesso não autorizado, incluindo controle de acesso por perfil e criptografia em
              trânsito (HTTPS/TLS).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              6. Seus direitos
            </h2>
            <p>
              Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção,
              portabilidade, anonimização ou eliminação dos seus dados, entrando em contato pelo
              e-mail{" "}
              <a
                href="mailto:privacidade@shinaia.com.br"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                privacidade@shinaia.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              7. Menores de idade
            </h2>
            <p>A plataforma não é direcionada a menores de 18 anos.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              8. Alterações desta política
            </h2>
            <p>
              Esta política pode ser atualizada periodicamente. Alterações relevantes serão
              comunicadas pelos canais habituais da plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
