import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { Avatar } from "../components/avatar";
import { GlassCard } from "../components/glass-card";
import { EmptyState } from "../components/empty-state";
import { ErrorState } from "../components/error-state";
import { SuccessState } from "../components/success-state";
import { Progress } from "../components/progress";
import { Table } from "../components/table";
import { Stepper } from "../components/stepper";
import { RadioCard } from "../components/radio-card";
import { Chip } from "../components/chip";
import { Toggle } from "../components/toggle";
import { RangeSlider } from "../components/range-slider";
import { cn } from "../utils/cn";

describe("cn", () => {
  it("filtra valores falsy", () => {
    expect(cn("a", false, undefined, "b", null)).toBe("a b");
  });
});

describe("Button", () => {
  it("renderiza o label e responde a clique", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Gerar anúncio</Button>);
    fireEvent.click(screen.getByText("Gerar anúncio"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading desabilita o botão e marca aria-busy", () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("Badge", () => {
  it("nunca usa cor sólida saturada — sempre bg translúcido via token", () => {
    render(<Badge variant="warning">Pendente</Badge>);
    const badge = screen.getByText("Pendente");
    expect(badge.className).toContain("warning-bg");
  });
});

describe("Avatar", () => {
  it("gera iniciais a partir do nome quando não há imagem", () => {
    render(<Avatar name="Fabio Silveira" />);
    expect(screen.getByText("FS")).toBeInTheDocument();
  });
});

describe("GlassCard", () => {
  it("aplica ring de atenção quando ring=warning", () => {
    const { container } = render(<GlassCard ring="warning">conteúdo</GlassCard>);
    expect(container.firstChild).toHaveClass("ring-amber-500/40");
  });
});

describe("EmptyState", () => {
  it("segue a regra do doc 03 P9: título + descrição + ação", () => {
    render(
      <EmptyState
        title="Nenhuma campanha"
        description="Crie sua primeira campanha para começar."
        action={<Button>Nova campanha</Button>}
      />,
    );
    expect(screen.getByText("Nenhuma campanha")).toBeInTheDocument();
    expect(screen.getByText("Crie sua primeira campanha para começar.")).toBeInTheDocument();
    expect(screen.getByText("Nova campanha")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renderiza o aiHint quando fornecido", () => {
    render(
      <EmptyState
        title="Nenhum anúncio ainda"
        description="Comece pesquisando um concorrente."
        aiHint="A IA sugere: importe seu primeiro Brand Kit."
      />,
    );
    expect(screen.getByText(/A IA sugere/)).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("usa a cópia padrão do código de erro (nunca culpa o usuário)", () => {
    render(<ErrorState code="offline" />);
    expect(screen.getByText("Sem conexão com a internet")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("permite sobrescrever título e descrição mantendo o código", () => {
    render(<ErrorState code="server" title="Falha ao gerar o vídeo" />);
    expect(screen.getByText("Falha ao gerar o vídeo")).toBeInTheDocument();
  });
});

describe("SuccessState", () => {
  it("renderiza título, descrição e ação", () => {
    render(
      <SuccessState
        title="Campanha publicada"
        description="Sua campanha já está no ar."
        action={<Button>Ver campanha</Button>}
      />,
    );
    expect(screen.getByText("Campanha publicada")).toBeInTheDocument();
    expect(screen.getByText("Ver campanha")).toBeInTheDocument();
  });
});

describe("Progress", () => {
  it("calcula a porcentagem e expõe aria-valuenow", () => {
    render(<Progress value={30} max={60} label="Uso" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });
});

describe("Table", () => {
  it("mostra emptyState quando não há linhas", () => {
    render(
      <Table
        columns={[{ key: "name", header: "Nome", render: (r: { name: string }) => r.name }]}
        rows={[]}
        rowKey={(r: { name: string }) => r.name}
        emptyState={<p>Vazio</p>}
      />,
    );
    expect(screen.getByText("Vazio")).toBeInTheDocument();
  });

  it("renderiza linhas e responde a clique", () => {
    const onRowClick = vi.fn();
    render(
      <Table
        columns={[{ key: "name", header: "Nome", render: (r: { name: string }) => r.name }]}
        rows={[{ name: "Campanha A" }]}
        rowKey={(r: { name: string }) => r.name}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("Campanha A"));
    expect(onRowClick).toHaveBeenCalledWith({ name: "Campanha A" });
  });
});

describe("Stepper", () => {
  it("marca o passo atual com aria-current e mostra concluídos", () => {
    render(
      <Stepper
        steps={[
          { id: "a", label: "Perfil" },
          { id: "b", label: "Recomendação" },
          { id: "c", label: "Revisão" },
        ]}
        current={1}
      />,
    );
    expect(screen.getByText("Recomendação").closest("button")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("permite clicar em passos já concluídos", () => {
    const onStepClick = vi.fn();
    render(
      <Stepper
        steps={[
          { id: "a", label: "Perfil" },
          { id: "b", label: "Recomendação" },
        ]}
        current={1}
        onStepClick={onStepClick}
      />,
    );
    fireEvent.click(screen.getByText("Perfil"));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});

describe("RadioCard", () => {
  it("expõe role radio e aria-checked, dispara onSelect", () => {
    const onSelect = vi.fn();
    render(
      <RadioCard title="Alugo carros" description="Locação" selected={false} onSelect={onSelect} />,
    );
    const card = screen.getByRole("radio");
    expect(card).toHaveAttribute("aria-checked", "false");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("usa role checkbox quando multiple", () => {
    render(<RadioCard title="Motos" selected onSelect={() => {}} multiple />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });
});

describe("Chip", () => {
  it("é interativo (role checkbox) e alterna", () => {
    const onToggle = vi.fn();
    render(<Chip label="Guincho" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("Toggle", () => {
  it("role switch, inverte o valor ao clicar", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Rastreamento" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("RangeSlider", () => {
  it("emite o novo valor numérico e mostra o valueLabel", () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={10}
        min={0}
        max={100}
        onChange={onChange}
        label="Ativos"
        valueLabel="10 ativos"
      />,
    );
    expect(screen.getByText("10 ativos")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });
});
