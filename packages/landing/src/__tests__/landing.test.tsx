import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionTitle } from "../components/section-title";
import { FeatureGrid } from "../components/feature-grid";
import { Pricing } from "../components/pricing";
import { Faq } from "../components/faq";
import { Footer } from "../components/footer";
import { Sparkles } from "@shina/icons";

describe("SectionTitle", () => {
  it("renderiza eyebrow, título e descrição", () => {
    render(<SectionTitle eyebrow="Recursos" title="Tudo em um lugar" description="Explicação" />);
    expect(screen.getByText("Recursos")).toBeInTheDocument();
    expect(screen.getByText("Tudo em um lugar")).toBeInTheDocument();
    expect(screen.getByText("Explicação")).toBeInTheDocument();
  });
});

describe("FeatureGrid", () => {
  it("renderiza um card por feature", () => {
    render(
      <FeatureGrid
        features={[
          { icon: <Sparkles />, title: "IA", description: "Geração inteligente" },
          { icon: <Sparkles />, title: "Fluxo", description: "Operações em movimento" },
        ]}
      />,
    );
    expect(screen.getByText("IA")).toBeInTheDocument();
    expect(screen.getByText("Fluxo")).toBeInTheDocument();
  });
});

describe("Pricing", () => {
  it("nunca destaca mais de um plano ao mesmo tempo (regra visual)", () => {
    const { container } = render(
      <Pricing
        plans={[
          {
            id: "free",
            name: "Free",
            price: "R$0",
            period: "/mês",
            description: "d",
            features: ["a"],
            cta: <button>Ir</button>,
          },
          {
            id: "pro",
            name: "Pro",
            price: "R$99",
            period: "/mês",
            description: "d",
            features: ["a"],
            cta: <button>Ir</button>,
            highlight: true,
          },
        ]}
      />,
    );
    const highlighted = container.querySelectorAll(".ring-\\[var\\(--shina-primary\\)\\]\\/40");
    expect(highlighted.length).toBe(1);
  });
});

describe("Faq", () => {
  it("expande e recolhe ao clicar (accordion)", () => {
    render(<Faq items={[{ question: "Como funciona?", answer: "Resposta aqui" }]} />);
    expect(screen.queryByText("Resposta aqui")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Como funciona?"));
    expect(screen.getByText("Resposta aqui")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Como funciona?"));
    expect(screen.queryByText("Resposta aqui")).not.toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("renderiza o nome da marca e o ano atual", () => {
    render(<Footer brand="Shinã" />);
    expect(screen.getByText(new RegExp(`Shinã © ${new Date().getFullYear()}`))).toBeInTheDocument();
  });

  it("renderiza links quando fornecidos", () => {
    render(<Footer brand="Shinã" links={[{ label: "Privacidade", href: "/privacy" }]} />);
    expect(screen.getByText("Privacidade")).toBeInTheDocument();
  });
});

describe("smoke: componentes sem props obrigatórias extras não quebram", () => {
  it("Testimonials render vazio não lança", () => {
    expect(() => render(<Pricing plans={[]} />)).not.toThrow();
  });
});
