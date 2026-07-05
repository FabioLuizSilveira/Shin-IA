import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { Avatar } from "../components/avatar";
import { GlassCard } from "../components/glass-card";
import { EmptyState } from "../components/empty-state";
import { Progress } from "../components/progress";
import { Table } from "../components/table";
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
